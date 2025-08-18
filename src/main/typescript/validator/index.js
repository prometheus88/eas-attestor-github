const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { ethers } = require('ethers');
const { exec } = require('child_process');
const { promisify } = require('util');
const { setTimeout: delay } = require('timers/promises');
require('dotenv').config();

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 8080;

// Configuration
const CONFIG = {
    retries: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2
    },
    timeouts: {
        gistFetch: 30000,
        secretResolution: 10000,
        validation: 120000
    },
    limits: {
        maxGistSize: process.env.MAX_GIST_SIZE || 100000,
        rateLimit: process.env.API_RATE_LIMIT || 10
    }
};

// Error classes
class ValidationError extends Error {
    constructor(message, code = 'VALIDATION_ERROR', statusCode = 400) {
        super(message);
        this.name = 'ValidationError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

class NetworkError extends Error {
    constructor(message, code = 'NETWORK_ERROR', statusCode = 502) {
        super(message);
        this.name = 'NetworkError';
        this.code = code;
        this.statusCode = statusCode;
        this.isRetryable = true;
    }
}

class SecretError extends Error {
    constructor(message, code = 'SECRET_ERROR', statusCode = 500) {
        super(message);
        this.name = 'SecretError';
        this.code = code;
        this.statusCode = statusCode;
        this.isRetryable = false;
    }
}

// Middleware - configure CSP to allow inline event handlers for dApp functionality
const defaultDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
delete defaultDirectives["script-src-attr"]; // Remove the restrictive default

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...defaultDirectives,
            "script-src": ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://esm.sh"],
            "script-src-attr": ["'unsafe-inline'"],
            "connect-src": ["'self'", "https://api.github.com", "https://base-sepolia.easscan.org"],
            "img-src": ["'self'", "data:", "https:"]
        }
    }
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from the HTML directory
// In container, the HTML files are in ./html/ relative to the app directory
const htmlDir = path.join(__dirname, 'html');
app.use(express.static(htmlDir));

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(htmlDir, 'index.html'));
});

// Retry utility with exponential backoff
async function retryWithBackoff(fn, options = {}) {
    const { maxAttempts = CONFIG.retries.maxAttempts, initialDelay = CONFIG.retries.initialDelay, 
            maxDelay = CONFIG.retries.maxDelay, backoffFactor = CONFIG.retries.backoffFactor } = options;
    
    let lastError;
    let currentDelay = initialDelay;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            // Don't retry if error is not retryable
            if (error.isRetryable === false || attempt === maxAttempts) {
                break;
            }
            
            console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, error.message);
            
            if (attempt < maxAttempts) {
                await delay(Math.min(currentDelay, maxDelay));
                currentDelay *= backoffFactor;
            }
        }
    }
    
    throw lastError;
}

// Map secret items to environment variable names for Kubernetes deployment
function getEnvironmentSecretName(secretItem) {
    const network = process.env.NETWORK || 'CLOUD';
    const environment = process.env.NODE_ENV === 'production' ? 'PROD' : 'STAGING';
    const component = 'VALIDATOR';
    
    return `DEPLOY_${network}_${environment}_${component}_${secretItem}`;
}

// 5D secret resolution with error handling
async function getSecret(secretItem) {
    const operation = async () => {
        // Try direct environment variable first (for Kubernetes)
        const envVarName = getEnvironmentSecretName(secretItem);
        if (process.env[envVarName]) {
            console.log(`Using direct environment variable: ${envVarName}`);
            return process.env[envVarName];
        }
        
        // Fallback to script-based resolution (for local development)
        const scriptPath = process.env.NODE_ENV === 'development' && process.env.DOCKER_ENV 
          ? '/usr/local/bin/resolve-secret.sh'
          : '../../../third_party/taskfile-repo-template/scripts/task/secrets/resolve-secret.sh';
          
        try {
            const { stdout } = await Promise.race([
                execAsync(`${scriptPath} ${secretItem}`),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Secret resolution timeout')), CONFIG.timeouts.secretResolution)
                )
            ]);
            
            const result = stdout.trim();
            if (!result) {
                throw new SecretError(`Empty secret value for ${secretItem}`, 'EMPTY_SECRET');
            }
            
            return result;
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new SecretError(`Secret resolution script not found and no environment variable ${envVarName}`, 'SCRIPT_NOT_FOUND', 500);
            } else if (error.message.includes('timeout')) {
                throw new NetworkError(`Secret resolution timed out for ${secretItem}`, 'SECRET_TIMEOUT');
            } else if (error.message.includes('not found')) {
                throw new SecretError(`Secret ${secretItem} not found in any store`, 'SECRET_NOT_FOUND', 404);
            }
            
            throw new SecretError(`Secret resolution failed: ${error.message}`, 'SECRET_RESOLUTION_FAILED');
        }
    };
    
    try {
        return await retryWithBackoff(operation, { maxAttempts: 2 });
    } catch (error) {
        console.error(`Failed to resolve secret ${secretItem} after retries:`, error.message);
        throw error;
    }
}

// Extract gist ID from URL
function extractGistId(gistUrl) {
  try {
    const url = new URL(gistUrl);
    const pathParts = url.pathname.split('/');
    return pathParts[pathParts.length - 1];
  } catch {
    return null;
  }
}

// Validate GitHub gist with comprehensive error handling
async function validateGist(githubUsername, gistUrl, ethereumAddress) {
    // Extract gist ID from URL
    const gistId = extractGistId(gistUrl);
    if (!gistId) {
        throw new ValidationError('Invalid gist URL format - should be https://gist.github.com/username/gistId', 'INVALID_GIST_URL');
    }

    const operation = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeouts.gistFetch);
        
        try {
            // Fetch gist content using GitHub's public API with timeout
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EAS-Validator-Service/1.0'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new ValidationError('Gist not found - please check the URL and ensure it\'s public', 'GIST_NOT_FOUND', 404);
                } else if (response.status === 403) {
                    throw new NetworkError('GitHub API rate limit exceeded - please try again later', 'RATE_LIMIT_EXCEEDED', 429);
                } else if (response.status >= 500) {
                    throw new NetworkError(`GitHub API server error: ${response.status}`, 'GITHUB_SERVER_ERROR');
                }
                
                let errorData = {};
                try {
                    errorData = await response.json();
                } catch (e) {
                    // Ignore JSON parsing errors for error response
                }
                
                throw new NetworkError(
                    `Failed to fetch gist: ${response.status} ${errorData.message || response.statusText}`, 
                    'GITHUB_API_ERROR'
                );
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new NetworkError('GitHub API request timed out - please try again', 'GITHUB_TIMEOUT');
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                throw new NetworkError('Unable to connect to GitHub API - please check your internet connection', 'NETWORK_UNAVAILABLE');
            } else if (error instanceof ValidationError || error instanceof NetworkError) {
                throw error;
            }
            
            throw new NetworkError(`Network error while fetching gist: ${error.message}`, 'NETWORK_ERROR');
        }
    };

    try {
        const response = await retryWithBackoff(operation);
        
        // Parse gist data with error handling
        let gistData;
        try {
            gistData = await response.json();
        } catch (error) {
            throw new NetworkError('Invalid JSON response from GitHub API', 'INVALID_JSON_RESPONSE');
        }
  
        // Verify gist owner matches the claimed GitHub username
        if (!gistData.owner) {
            throw new ValidationError('Gist has no owner information', 'GIST_NO_OWNER');
        }
        
        if (gistData.owner.login !== githubUsername) {
            throw new ValidationError(
                `Gist owner (${gistData.owner.login}) does not match GitHub username (${githubUsername})`, 
                'GIST_OWNER_MISMATCH'
            );
        }

        // Get the content of the first file in the gist
        const files = Object.values(gistData.files || {});
        if (files.length === 0) {
            throw new ValidationError('Gist is empty - no files found', 'GIST_EMPTY');
        }

        const firstFile = files[0];
        if (!firstFile.content) {
            throw new ValidationError('Gist file has no content', 'GIST_NO_CONTENT');
        }
        
        // Check gist size
        if (firstFile.content.length > CONFIG.limits.maxGistSize) {
            throw new ValidationError(
                `Gist content too large (${firstFile.content.length} bytes, max ${CONFIG.limits.maxGistSize})`, 
                'GIST_TOO_LARGE'
            );
        }

        const gistContent = firstFile.content;
        
        // Parse and validate the JSON content
        let verificationData;
        try {
            verificationData = JSON.parse(gistContent);
        } catch (error) {
            throw new ValidationError('Gist does not contain valid JSON', 'INVALID_JSON_CONTENT');
        }

        // Validate required fields
        const requiredFields = ['github_username', 'address', 'signature', 'message'];
        for (const field of requiredFields) {
            if (!verificationData[field]) {
                throw new ValidationError(`Missing required field: ${field}`, 'MISSING_FIELD');
            }
        }

        // Verify the required fields match
        if (verificationData.github_username !== githubUsername) {
            throw new ValidationError(
                'GitHub username in gist does not match claimed username', 
                'USERNAME_MISMATCH'
            );
        }

        if (verificationData.address?.toLowerCase() !== ethereumAddress.toLowerCase()) {
            throw new ValidationError(
                'Ethereum address in gist does not match provided address', 
                'ADDRESS_MISMATCH'
            );
        }

        // Verify that the signature is valid
        try {
            const recoveredAddress = ethers.verifyMessage(verificationData.message, verificationData.signature);
            if (recoveredAddress.toLowerCase() !== ethereumAddress.toLowerCase()) {
                throw new ValidationError(
                    'Signature verification failed - signature does not match the ethereum address', 
                    'SIGNATURE_MISMATCH'
                );
            }
        } catch (sigError) {
            if (sigError instanceof ValidationError) {
                throw sigError;
            }
            throw new ValidationError(`Signature verification failed: ${sigError.message}`, 'SIGNATURE_INVALID');
        }

        return {
            gistId,
            verificationData,
            validatedAt: Math.floor(Date.now() / 1000)
        };
        
    } catch (error) {
        if (error instanceof ValidationError || error instanceof NetworkError) {
            throw error;
        }
        
        console.error('Unexpected error in validateGist:', error);
        throw new ValidationError(`Validation failed: ${error.message}`, 'VALIDATION_FAILED');
    }
}

// Sign validation result
async function signValidationResult(githubUsername, ethereumAddress, gistId, validatedAt) {
  try {
    // Get private key using 5D secret resolution pattern
    const privateKey = await getSecret('PRIVATE_KEY');
    const wallet = new ethers.Wallet(privateKey);
    
    // Create validation message
    const message = `GitHub:${githubUsername}|ETH:${ethereumAddress}|Gist:${gistId}|Time:${validatedAt}`;
    
    // Sign the validation message
    const signature = await wallet.signMessage(message);
    
    return {
      validationSig: signature,
      validatedAt,
      validator: wallet.address,
      message
    };
  } catch (error) {
    console.error('Signing failed:', error);
    throw new Error(`Failed to sign validation result: ${error.message}`);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'eas-validator-service'
  });
});

// Global error handler middleware
function errorHandler(error, req, res, next) {
    const responseTime = Date.now() - (req.startTime || Date.now());
    
    console.error('Error processing request:', {
        error: error.message,
        code: error.code || 'UNKNOWN',
        statusCode: error.statusCode || 500,
        stack: error.stack,
        request: {
            method: req.method,
            url: req.url,
            ip: req.ip
        }
    });

    // Determine status code
    let statusCode = 500;
    let errorResponse = {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        responseTime
    };

    if (error instanceof ValidationError) {
        statusCode = error.statusCode;
        errorResponse.error = error.message;
        errorResponse.code = error.code;
    } else if (error instanceof NetworkError) {
        statusCode = error.statusCode;
        errorResponse.error = error.message;
        errorResponse.code = error.code;
        if (error.isRetryable) {
            errorResponse.retryable = true;
        }
    } else if (error instanceof SecretError) {
        statusCode = error.statusCode;
        errorResponse.error = 'Service configuration error';
        errorResponse.code = 'SERVICE_ERROR';
    }

    res.status(statusCode).json(errorResponse);
}

// Input validation middleware
function validateInput(req, res, next) {
    const { githubUsername, gistUrl, ethereumAddress } = req.body;
    
    // Check required fields
    const missingFields = [];
    if (!githubUsername) missingFields.push('githubUsername');
    if (!gistUrl) missingFields.push('gistUrl');
    if (!ethereumAddress) missingFields.push('ethereumAddress');
    
    if (missingFields.length > 0) {
        throw new ValidationError(
            `Missing required fields: ${missingFields.join(', ')}`, 
            'MISSING_FIELDS'
        );
    }

    // Validate types and formats
    if (typeof githubUsername !== 'string' || githubUsername.length === 0) {
        throw new ValidationError('githubUsername must be a non-empty string', 'INVALID_USERNAME');
    }
    
    if (typeof gistUrl !== 'string' || !gistUrl.startsWith('https://gist.github.com/')) {
        throw new ValidationError('gistUrl must be a valid GitHub Gist URL', 'INVALID_GIST_URL');
    }

    // Validate Ethereum address format
    if (!ethers.isAddress(ethereumAddress)) {
        throw new ValidationError('Invalid Ethereum address format', 'INVALID_ADDRESS');
    }
    
    // Validate username format (basic GitHub username rules)
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-])*[a-zA-Z0-9]$/.test(githubUsername) && githubUsername.length > 39) {
        throw new ValidationError('Invalid GitHub username format', 'INVALID_USERNAME_FORMAT');
    }

    next();
}

// Main validation endpoint with comprehensive error handling
app.post('/validate', (req, res, next) => {
    req.startTime = Date.now();
    next();
}, validateInput, async (req, res, next) => {
    try {
        const { githubUsername, gistUrl, ethereumAddress } = req.body;
        const startTime = req.startTime;
        
        console.log(`Validating: ${githubUsername} -> ${ethereumAddress}`);
        
        // Set validation timeout
        const validationPromise = Promise.race([
            (async () => {
                // Validate the gist
                const validation = await validateGist(githubUsername, gistUrl, ethereumAddress);
                
                // Sign the validation result
                const signedResult = await signValidationResult(
                    githubUsername,
                    ethereumAddress,
                    validation.gistId,
                    validation.validatedAt
                );
                
                return { validation, signedResult };
            })(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new ValidationError(
                    'Validation timeout - request took too long to process', 
                    'VALIDATION_TIMEOUT', 
                    504
                )), CONFIG.timeouts.validation)
            )
        ]);
        
        const { validation, signedResult } = await validationPromise;
        
        const responseTime = Date.now() - startTime;
        console.log(`Validation successful in ${responseTime}ms: ${githubUsername}`);
        
        res.json({
            success: true,
            ...signedResult,
            responseTime
        });

    } catch (error) {
        next(error);
    }
});

// Apply error handler middleware
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`EAS Validator Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Validation endpoint: POST http://localhost:${PORT}/validate`);
});
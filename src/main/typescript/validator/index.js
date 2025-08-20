const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { ethers } = require('ethers');
const { exec } = require('child_process');
const { promisify } = require('util');
const { setTimeout: delay } = require('timers/promises');
require('dotenv').config();

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 8080;

// Load EAS schemas configuration
let SCHEMAS = {};
try {
    // Try multiple possible paths for schema config
    const possiblePaths = [
        path.join(__dirname, '../../config/schemas-staging.json'),
        path.join(__dirname, '../../../src/main/config/schemas-staging.json'),
        path.join(__dirname, 'config/schemas-staging.json')
    ];
    
    let schemaPath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            schemaPath = p;
            break;
        }
    }
    
    if (schemaPath) {
        SCHEMAS = JSON.parse(fs.readFileSync(schemaPath, 'utf8')).schemas;
        console.log('📋 Loaded EAS schemas:', Object.keys(SCHEMAS));
    } else {
        console.warn('⚠️  Schema config not found, will skip EAS attestation creation');
        console.warn('Tried paths:', possiblePaths);
    }
} catch (error) {
    console.error('❌ Failed to load EAS schemas:', error.message);
}

// EAS Configuration
const EAS_CONFIG = {
    contractAddress: '0x4200000000000000000000000000000000000021', // Base Sepolia
    rpcUrl: process.env.NODE_ENV === 'production' 
        ? 'https://mainnet.base.org' 
        : 'https://sepolia.base.org'
};

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
    },
    // Note: Repository allowlist replaced with EAS-based registration lookup
    // allowedRepositories: [] // No longer used
};

// Structured logging configuration
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const currentLogLevel = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : LOG_LEVELS.INFO;

function log(level, message, data = {}) {
    if (LOG_LEVELS[level] <= currentLogLevel) {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            message,
            service: 'eas-validator',
            ...data
        }));
    }
}

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

// Direct secret resolution from environment variables only
async function getSecret(secretItem) {
    const envVarName = getEnvironmentSecretName(secretItem);
    console.log(`Looking for environment variable: ${envVarName}`);
    
    const value = process.env[envVarName];
    if (!value) {
        const errorMessage = `Secret ${secretItem} not found. Expected environment variable: ${envVarName}`;
        console.error(errorMessage);
        throw new SecretError(errorMessage, 'SECRET_NOT_FOUND', 404);
    }
    
    console.log(`✅ Found secret: ${envVarName}`);
    return value;
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

// GitHub webhook signature validation
function verifyGitHubSignature(payload, signature, secret) {
    if (!signature || !signature.startsWith('sha256=')) {
        return false;
    }
    
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = 'sha256=' + hmac.digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

// Derive webhook secret for repository (stateless)
async function deriveWebhookSecret(repositoryFullName, registrantSignature) {
    try {
        const privateKey = await getSecret('PRIVATE_KEY');
        const data = repositoryFullName + registrantSignature + privateKey;
        return ethers.keccak256(ethers.toUtf8Bytes(data));
    } catch (error) {
        console.error('Failed to derive webhook secret:', error);
        throw new Error('Unable to derive webhook secret');
    }
}

// Filter GitHub events for high-value contributions
function isHighValueContribution(eventType, action) {
    const highValueEvents = {
        'issues': ['closed'],
        'pull_request': ['merged'],
        'pull_request_review': ['submitted']
    };
    
    return highValueEvents[eventType]?.includes(action);
}

// Resolve contributor identity from GitHub username via EAS GraphQL
async function resolveContributorIdentity(githubUsername) {
    try {
        console.log(`🔍 Resolving identity for GitHub user: ${githubUsername}`);
        
        // Query EAS GraphQL endpoint for identity attestations
        const easGraphqlUrl = 'https://base-sepolia.easscan.org/graphql';
        const identitySchemaUid = SCHEMAS.identity?.uid;
        
        if (!identitySchemaUid) {
            throw new Error('Identity schema UID not found in configuration');
        }
        
        const query = `
        query GetIdentityAttestations($schemaId: String!) {
          attestations(
            where: {
              schemaId: { equals: $schemaId }
              revoked: { equals: false }
            }
            orderBy: { time: desc }
            take: 20
          ) {
            id
            attester  
            recipient
            decodedDataJson
            time
            revoked
          }
        }`;
        
        const variables = {
            schemaId: identitySchemaUid
        };
        
        console.log(`📡 Querying EAS GraphQL for identity attestations...`);
        
        const response = await fetch(easGraphqlUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`GraphQL request failed: ${response.status}`, errorText);
            throw new Error(`GraphQL request failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.errors) {
            console.error(`GraphQL errors:`, result.errors);
            throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
        }
        
        const attestations = result.data?.attestations || [];
        console.log(`📋 Found ${attestations.length} identity attestations`);
        
        // Find attestation for this specific GitHub username
        for (const attestation of attestations) {
            try {
                const decodedData = JSON.parse(attestation.decodedDataJson);
                
                // Look for attestation with matching domain and identifier
                const domainValue = decodedData.find(d => d.name === 'domain')?.value?.value;
                const identifierValue = decodedData.find(d => d.name === 'identifier')?.value?.value;
                
                if (domainValue === 'github.com' && identifierValue === githubUsername) {
                    console.log(`✅ Found identity attestation for ${githubUsername}:`, attestation.id);
                    
                    // Extract the Ethereum address from the attestation
                    // The contributor address should be the recipient of the identity attestation
                    const contributorAddress = attestation.recipient;
                    const identityAttestationUid = attestation.id;
                    
                    return { contributorAddress, identityAttestationUid };
                }
            } catch (parseError) {
                console.warn(`Failed to parse attestation data:`, parseError.message);
                continue;
            }
        }
        
        console.log(`⚠️  No identity attestation found for GitHub user: ${githubUsername}`);
        
        // Return zero values if not found
        return {
            contributorAddress: '0x0000000000000000000000000000000000000000',
            identityAttestationUid: '0x0000000000000000000000000000000000000000000000000000000000000000'
        };
        
    } catch (error) {
        console.error(`Failed to resolve contributor identity for ${githubUsername}:`, error.message);
        
        // Return zero values on error
        return {
            contributorAddress: '0x0000000000000000000000000000000000000000',
            identityAttestationUid: '0x0000000000000000000000000000000000000000000000000000000000000000'
        };
    }
}

// Repository registration cache
const repositoryCache = new Map(); // Simple in-memory cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Resolve repository registration from EAS with caching
async function resolveRepositoryRegistration(repositoryFullName) {
    // Check cache first
    const cacheKey = `repo:${repositoryFullName}`;
    const cached = repositoryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        log('INFO', 'Repository lookup cache hit', { repository: repositoryFullName, cached: true });
        return cached.data;
    }

    log('INFO', 'Repository lookup cache miss, querying EAS', { repository: repositoryFullName, cached: false });
    
    try {
        // Query EAS GraphQL endpoint for repository registration attestations
        const easGraphqlUrl = process.env.NODE_ENV === 'production' 
            ? 'https://base.easscan.org/graphql'
            : 'https://base-sepolia.easscan.org/graphql';
        
        const repositorySchemaUid = SCHEMAS['repository-registration']?.uid;
        
        if (!repositorySchemaUid) {
            throw new Error('Repository registration schema UID not found in configuration');
        }
        
        const query = `
        query GetRepositoryRegistrations($schemaId: String!) {
          attestations(
            where: {
              schemaId: { equals: $schemaId }
              revoked: { equals: false }
            }
            orderBy: { time: desc }
            take: 50
          ) {
            id
            attester  
            recipient
            decodedDataJson
            time
            revoked
          }
        }`;
        
        const variables = {
            schemaId: repositorySchemaUid
        };
        
        console.log(`📡 Querying EAS GraphQL for repository registration attestations...`);
        
        const response = await fetch(easGraphqlUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`GraphQL request failed: ${response.status}`, errorText);
            throw new Error(`GraphQL request failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.errors) {
            console.error(`GraphQL errors:`, result.errors);
            throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
        }
        
        const attestations = result.data?.attestations || [];
        console.log(`📋 Found ${attestations.length} repository registration attestations`);
        
        // Find attestation for this specific repository
        for (const attestation of attestations) {
            try {
                const decodedData = JSON.parse(attestation.decodedDataJson);
                
                // Look for attestation with matching domain and path
                const domainValue = decodedData.find(d => d.name === 'domain')?.value?.value;
                const pathValue = decodedData.find(d => d.name === 'path')?.value?.value;
                const registrantSignature = decodedData.find(d => d.name === 'registrantSignature')?.value?.value;
                
                const fullRepoName = `${domainValue}/${pathValue}`;
                if (fullRepoName === `github.com/${repositoryFullName}`) {
                    console.log(`✅ Found repository registration for ${repositoryFullName}:`, attestation.id);
                    
                    const registrationData = {
                        isRegistered: true,
                        registrationUid: attestation.id,
                        registrantSignature: registrantSignature,
                        registrantAddress: attestation.recipient
                    };
                    
                    // Cache the result
                    repositoryCache.set(cacheKey, {
                        data: registrationData,
                        timestamp: Date.now()
                    });
                    
                    return registrationData;
                }
            } catch (parseError) {
                console.warn(`Failed to parse repository registration data:`, parseError.message);
                continue;
            }
        }
        
        console.log(`⚠️  No repository registration found for: ${repositoryFullName}`);
        
        // Cache negative result to avoid repeated queries
        const noRegistrationData = { isRegistered: false };
        repositoryCache.set(cacheKey, {
            data: noRegistrationData,
            timestamp: Date.now()
        });
        
        return noRegistrationData;
        
    } catch (error) {
        console.error(`Failed to resolve repository registration for ${repositoryFullName}:`, error.message);
        
        // Return negative result on error
        return { isRegistered: false };
    }
}

// Create EAS attestation for repository registration
async function createRepositoryRegistrationAttestation(registrationData) {
    if (!SCHEMAS || Object.keys(SCHEMAS).length === 0) {
        console.log('⚠️  No schemas loaded, skipping attestation creation');
        return null;
    }
    
    try {
        // Get private key and create wallet
        const privateKey = await getSecret('PRIVATE_KEY');
        const provider = new ethers.JsonRpcProvider(EAS_CONFIG.rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        
        // Create EAS contract interface
        const easAbi = [
            "function attest((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data) request) returns (bytes32)"
        ];
        const easContract = new ethers.Contract(EAS_CONFIG.contractAddress, easAbi, wallet);
        
        const schema = SCHEMAS['repository-registration'];
        if (!schema) {
            throw new Error('Repository registration schema not found');
        }
        
        // Encode attestation data: string domain,string path,address registrant,bytes registrantSignature,uint256 registeredAt
        const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
            ['string', 'string', 'address', 'bytes', 'uint256'],
            [
                registrationData.domain,
                registrationData.repositoryPath,
                registrationData.registrantAddress,
                registrationData.signature,
                registrationData.timestamp
            ]
        );
        
        // Create attestation request
        const attestationRequest = {
            schema: schema.uid,
            data: {
                recipient: registrationData.registrantAddress, // Repository owner as recipient
                expirationTime: 0, // No expiration
                revocable: false,
                refUID: '0x0000000000000000000000000000000000000000000000000000000000000000', // No reference
                data: encodedData,
                value: 0 // No ETH value
            }
        };
        
        console.log('📝 Creating repository registration attestation:', {
            schema: 'repository-registration',
            schemaUID: schema.uid,
            domain: registrationData.domain,
            repository: registrationData.repositoryPath,
            registrant: registrationData.registrantAddress
        });
        
        // Submit attestation to EAS
        const tx = await easContract.attest(attestationRequest);
        const receipt = await tx.wait();
        
        console.log('✅ Repository registration attestation created:', {
            txHash: receipt.hash,
            gasUsed: receipt.gasUsed.toString()
        });
        
        return receipt.hash;
        
    } catch (error) {
        console.error('❌ Failed to create repository registration attestation:', error.message);
        throw error;
    }
}

// Create EAS attestation for contribution
async function createContributionAttestation(contributionData) {
    if (!SCHEMAS || Object.keys(SCHEMAS).length === 0) {
        console.log('⚠️  No schemas loaded, skipping attestation creation');
        return null;
    }
    
    try {
        // Get private key and create wallet
        const privateKey = await getSecret('PRIVATE_KEY');
        const provider = new ethers.JsonRpcProvider(EAS_CONFIG.rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        
        // Create EAS contract interface
        const easAbi = [
            "function attest((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data) request) returns (bytes32)"
        ];
        const easContract = new ethers.Contract(EAS_CONFIG.contractAddress, easAbi, wallet);
        
        // Determine schema based on contribution type
        let schemaKey;
        if (contributionData.type === 'issues') {
            schemaKey = 'issue-contribution';
        } else if (contributionData.type === 'pull_request') {
            schemaKey = 'pull-request-contribution';
        } else if (contributionData.type === 'pull_request_review') {
            schemaKey = 'review-contribution';
        } else {
            throw new Error(`Unsupported contribution type: ${contributionData.type}`);
        }
        
        const schema = SCHEMAS[schemaKey];
        if (!schema) {
            throw new Error(`Schema not found for: ${schemaKey}`);
        }
        
        // Helper functions for event type mapping
        const getIssueEventString = (action) => {
            if (action === 'closed') return 'ISSUE_EVENT_RESOLVED';
            return 'ISSUE_EVENT_OPENED';
        };
        
        const getPREventString = (action) => {
            if (action === 'merged' || (action === 'closed' && contributionData.merged)) return 'PR_EVENT_MERGED';
            if (action === 'closed') return 'PR_EVENT_CLOSED';  
            return 'PR_EVENT_OPENED';
        };
        
        const getReviewEventString = (action) => {
            if (action === 'approved') return 'REVIEW_EVENT_APPROVED';
            return 'REVIEW_EVENT_CHANGES_REQUESTED';
        };

        // Resolve contributor Ethereum address and identity attestation UID
        const { contributorAddress, identityAttestationUid } = await resolveContributorIdentity(contributionData.contributor);
        
        // Use repository registration UID from contribution data
        const repositoryRegistrationUid = contributionData.repositoryRegistrationUid || '0x0000000000000000000000000000000000000000000000000000000000000000';

        // Encode attestation data based on schema
        let encodedData;
        if (schemaKey === 'issue-contribution') {
            // Current schema: string domain,string path,address contributor,bytes32 identityAttestationUid,bytes32 repositoryRegistrationUid,string url,uint256 occurredAt,uint32 eventType
            // Note: eventType should be string but schema currently uses uint32 - using enum value for now
            const eventTypeValue = contributionData.action === 'closed' ? 2 : 1;
            encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['string', 'string', 'address', 'bytes32', 'bytes32', 'string', 'uint256', 'uint32'],
                [
                    'github.com',
                    contributionData.repository,
                    contributorAddress,
                    identityAttestationUid,
                    repositoryRegistrationUid,
                    contributionData.url,
                    Math.floor(Date.now() / 1000),
                    eventTypeValue
                ]
            );
        } else if (schemaKey === 'pull-request-contribution') {
            // Current schema: string domain,string path,address contributor,bytes32 identityAttestationUid,bytes32 repositoryRegistrationUid,string url,uint256 occurredAt,uint32 eventType,string commitHash,bytes32[] linkedIssueUids
            const eventTypeValue = contributionData.action === 'merged' ? 2 : (contributionData.action === 'closed' ? 3 : 1);
            encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['string', 'string', 'address', 'bytes32', 'bytes32', 'string', 'uint256', 'uint32', 'string', 'bytes32[]'],
                [
                    'github.com',
                    contributionData.repository,
                    contributorAddress,
                    identityAttestationUid,
                    repositoryRegistrationUid,
                    contributionData.url,
                    Math.floor(Date.now() / 1000),
                    eventTypeValue,
                    contributionData.commitHash || '',
                    [] // TODO: extract linked issue UIDs
                ]
            );
        } else if (schemaKey === 'review-contribution') {
            // Current schema: string domain,string path,address contributor,bytes32 identityAttestationUid,bytes32 repositoryRegistrationUid,string url,uint256 occurredAt,uint32 eventType,bytes32 reviewedPrUid
            const eventTypeValue = contributionData.action === 'approved' ? 1 : 2;
            encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
                ['string', 'string', 'address', 'bytes32', 'bytes32', 'string', 'uint256', 'uint32', 'bytes32'],
                [
                    'github.com',
                    contributionData.repository,
                    contributorAddress,
                    identityAttestationUid,
                    repositoryRegistrationUid,
                    contributionData.url,
                    Math.floor(Date.now() / 1000),
                    eventTypeValue,
                    '0x0000000000000000000000000000000000000000000000000000000000000000' // TODO: reviewed PR UID
                ]
            );
        }
        
        // Create attestation request
        const attestationRequest = {
            schema: schema.uid,
            data: {
                recipient: '0x0000000000000000000000000000000000000000', // No specific recipient
                expirationTime: 0, // No expiration
                revocable: false,
                refUID: '0x0000000000000000000000000000000000000000000000000000000000000000', // No reference
                data: encodedData,
                value: 0 // No ETH value
            }
        };
        
        console.log('📝 Creating EAS attestation:', {
            schema: schemaKey,
            schemaUID: schema.uid,
            contributor: contributionData.contributor,
            repository: contributionData.repository,
            type: contributionData.type,
            action: contributionData.action
        });
        
        // Submit attestation to EAS
        const tx = await easContract.attest(attestationRequest);
        const receipt = await tx.wait();
        
        console.log('✅ EAS attestation created:', {
            txHash: receipt.hash,
            gasUsed: receipt.gasUsed.toString()
        });
        
        return receipt.hash;
        
    } catch (error) {
        console.error('❌ Failed to create EAS attestation:', error.message);
        throw error;
    }
}

// Process GitHub webhook event
async function processWebhookEvent(event) {
    const { repository, action, sender } = event;
    
    if (!repository || !repository.full_name) {
        throw new ValidationError('Invalid webhook payload: missing repository info', 'INVALID_PAYLOAD');
    }
    
    // Check if repository is registered (no hardcoded allowlist fallback)
    const repositoryRegistration = await resolveRepositoryRegistration(repository.full_name);
    if (!repositoryRegistration.isRegistered) {
        throw new ValidationError(`Repository ${repository.full_name} not registered for contribution tracking`, 'REPOSITORY_NOT_REGISTERED');
    }

    // Store registration data for later use
    event.repositoryRegistration = repositoryRegistration;
    
    // Determine event type from webhook headers or payload
    let eventType, eventAction, eventUrl;
    
    if (event.issue) {
        eventType = 'issues';
        eventAction = action;
        eventUrl = event.issue.html_url;
    } else if (event.pull_request) {
        eventType = 'pull_request';
        eventAction = action;
        eventUrl = event.pull_request.html_url;
    } else if (event.review) {
        eventType = 'pull_request_review';
        eventAction = action;
        eventUrl = event.review.html_url;
    } else {
        console.log(`Ignoring unsupported event type for repo ${repository.full_name}`);
        return { success: true, message: 'Event type not tracked' };
    }
    
    log('INFO', 'Processing contribution', {
        repository: repository.full_name,
        contributor: sender?.login,
        type: eventType,
        action: eventAction,
        url: eventUrl,
        registered: true
    });
    
    // Create contribution data for EAS attestation
    const contributionData = {
        type: eventType,
        action: eventAction,
        repository: repository.full_name,
        contributor: sender?.login,
        url: eventUrl,
        commitHash: event.pull_request?.merge_commit_sha || event.pull_request?.head?.sha,
        repositoryRegistrationUid: event.repositoryRegistration?.registrationUid
    };
    
    try {
        // Create EAS attestation
        const attestationTxHash = await createContributionAttestation(contributionData);
        
        return {
            success: true,
            message: 'EAS attestation created',
            attestationTxHash,
            contribution: contributionData
        };
        
    } catch (error) {
        console.error('Failed to create EAS attestation:', error.message);
        
        // Rethrow configuration errors as HTTP errors
        if (error instanceof SecretError) {
            error.statusCode = 500;
            error.httpHeader = 'X-EAS-Error';
            throw error;
        }
        
        // For other errors, still process but log failure
        return {
            success: true,
            message: 'Contribution processed but EAS attestation failed',
            error: error.message,
            contribution: contributionData
        };
    }
}

// GitHub webhook endpoint  
app.post('/webhook', async (req, res, next) => {
    try {
        const signature = req.headers['x-hub-signature-256'];
        const event = req.headers['x-github-event'];
        const webhookData = req.body;
        
        if (!event) {
            return res.status(400).json({
                success: false,
                error: 'Missing X-GitHub-Event header',
                code: 'MISSING_HEADERS'
            });
        }
        
        if (!webhookData || typeof webhookData !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid JSON payload',
                code: 'INVALID_JSON'
            });
        }
        
        // Validate GitHub HMAC signature
        if (signature) {
            const repoRegistration = await resolveRepositoryRegistration(webhookData.repository.full_name);
            if (!repoRegistration?.isRegistered) {
                return res.status(404).json({
                    success: false,
                    error: 'Repository not registered for contribution tracking',
                    code: 'REPOSITORY_NOT_REGISTERED'
                });
            }
            
            const webhookSecret = await deriveWebhookSecret(
                webhookData.repository.full_name, 
                repoRegistration.registrantSignature
            );
            
            const payload = JSON.stringify(webhookData);
            const isValidSignature = verifyGitHubSignature(payload, signature, webhookSecret);
            
            if (!isValidSignature) {
                log('WARN', 'Invalid webhook signature', { 
                    repository: webhookData.repository.full_name,
                    valid: false,
                    hasSignature: true
                });
                return res.status(401).json({
                    success: false,
                    error: 'Invalid webhook signature',
                    code: 'INVALID_SIGNATURE'
                });
            }
            
            log('INFO', 'Valid webhook signature', { 
                repository: webhookData.repository.full_name,
                valid: true,
                hasSignature: true
            });
        } else {
            log('WARN', 'No signature provided for webhook', { 
                repository: webhookData.repository?.full_name,
                hasSignature: false
            });
        }
        
        console.log(`📥 GitHub webhook received: ${event} for ${webhookData.repository?.full_name}`);
        
        // Process the webhook event
        const result = await processWebhookEvent(webhookData);
        
        res.json(result);
        
    } catch (error) {
        next(error);
    }
});

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
        
        // Add error details to header for debugging
        if (error.httpHeader) {
            res.set(error.httpHeader, error.message);
        }
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

// Repository registration endpoint
app.post('/register-repository', async (req, res, next) => {
    try {
        const { domain, repositoryPath, registrantAddress, signature } = req.body;
        
        // Validate required fields
        if (!domain || !repositoryPath || !registrantAddress || !signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: domain, repositoryPath, registrantAddress, signature',
                code: 'MISSING_FIELDS'
            });
        }
        
        // Validate Ethereum address format
        if (!ethers.isAddress(registrantAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Ethereum address format',
                code: 'INVALID_ADDRESS'
            });
        }
        
        // Create the expected message format
        const timestamp = Math.floor(Date.now() / 1000);
        const message = `I own the repository: ${repositoryPath}\nDomain: ${domain}\nRegistrant: ${registrantAddress}\nTimestamp: ${timestamp}`;
        
        console.log(`🔐 Verifying repository registration signature for ${repositoryPath}`);
        
        // Verify the signature
        try {
            const recoveredAddress = ethers.verifyMessage(message, signature);
            if (recoveredAddress.toLowerCase() !== registrantAddress.toLowerCase()) {
                return res.status(400).json({
                    success: false,
                    error: 'Signature verification failed - signature does not match the registrant address',
                    code: 'SIGNATURE_MISMATCH'
                });
            }
        } catch (sigError) {
            return res.status(400).json({
                success: false,
                error: `Signature verification failed: ${sigError.message}`,
                code: 'SIGNATURE_INVALID'
            });
        }
        
        console.log(`✅ Signature verified for ${repositoryPath} by ${registrantAddress}`);
        
        // Create repository registration attestation
        const registrationData = {
            domain,
            repositoryPath,
            registrantAddress,
            signature,
            timestamp
        };
        
        const attestationTxHash = await createRepositoryRegistrationAttestation(registrationData);
        
        res.json({
            success: true,
            message: 'Repository registered successfully',
            attestationTxHash,
            repository: `${domain}/${repositoryPath}`,
            registrant: registrantAddress,
            timestamp
        });
        
    } catch (error) {
        next(error);
    }
});

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
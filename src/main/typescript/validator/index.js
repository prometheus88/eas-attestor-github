const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { ethers } = require('ethers');
const { exec } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Bitwarden secret retrieval
async function getSecret(secretId) {
  try {
    const { stdout } = await execAsync(`bws secret get ${secretId}`);
    return stdout.trim();
  } catch (error) {
    console.error(`Failed to get secret ${secretId}:`, error.message);
    throw new Error(`Secret retrieval failed: ${secretId}`);
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

// Validate GitHub gist
async function validateGist(githubUsername, gistUrl, ethereumAddress) {
  // Extract gist ID from URL
  const gistId = extractGistId(gistUrl);
  if (!gistId) {
    throw new Error('Invalid gist URL format');
  }

  // Fetch gist content using GitHub's public API
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'EAS-Validator-Service/1.0'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Gist not found - please check the URL');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to fetch gist: ${response.status} ${errorData.message || ''}`);
  }

  const gistData = await response.json();
  
  // Verify gist owner matches the claimed GitHub username
  if (gistData.owner?.login !== githubUsername) {
    throw new Error(`Gist owner (${gistData.owner?.login || 'unknown'}) does not match GitHub username (${githubUsername})`);
  }

  // Get the content of the first file in the gist
  const files = Object.values(gistData.files);
  if (files.length === 0) {
    throw new Error('Gist is empty');
  }

  const gistContent = files[0].content;
  
  // Parse and validate the JSON content
  let verificationData;
  try {
    verificationData = JSON.parse(gistContent);
  } catch (error) {
    throw new Error('Gist does not contain valid JSON');
  }

  // Verify the required fields match
  if (verificationData.github_username !== githubUsername) {
    throw new Error('GitHub username in gist does not match claimed username');
  }

  if (verificationData.address?.toLowerCase() !== ethereumAddress.toLowerCase()) {
    throw new Error('Ethereum address in gist does not match provided address');
  }

  // Verify the signature
  if (!verificationData.signature || !verificationData.message) {
    throw new Error('Gist is missing required signature or message fields');
  }

  // Verify that the signature is valid
  try {
    const recoveredAddress = ethers.verifyMessage(verificationData.message, verificationData.signature);
    if (recoveredAddress.toLowerCase() !== ethereumAddress.toLowerCase()) {
      throw new Error('Signature verification failed - signature does not match the ethereum address');
    }
  } catch (sigError) {
    throw new Error(`Signature verification failed: ${sigError.message}`);
  }

  return {
    gistId,
    verificationData,
    validatedAt: Math.floor(Date.now() / 1000)
  };
}

// Sign validation result
async function signValidationResult(githubUsername, ethereumAddress, gistId, validatedAt) {
  try {
    // Get private key from Bitwarden or environment
    const privateKey = process.env.VALIDATOR_PRIVATE_KEY || await getSecret('validator-private-key');
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

// Main validation endpoint
app.post('/validate', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { githubUsername, gistUrl, ethereumAddress } = req.body;
    
    // Input validation
    if (!githubUsername || !gistUrl || !ethereumAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: githubUsername, gistUrl, ethereumAddress'
      });
    }

    // Validate Ethereum address format
    if (!ethers.isAddress(ethereumAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
    }

    console.log(`Validating: ${githubUsername} -> ${ethereumAddress}`);
    
    // Validate the gist
    const validation = await validateGist(githubUsername, gistUrl, ethereumAddress);
    
    // Sign the validation result
    const signedResult = await signValidationResult(
      githubUsername,
      ethereumAddress,
      validation.gistId,
      validation.validatedAt
    );
    
    const responseTime = Date.now() - startTime;
    console.log(`Validation successful in ${responseTime}ms: ${githubUsername}`);
    
    res.json({
      success: true,
      ...signedResult,
      responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`Validation failed in ${responseTime}ms:`, error.message);
    
    res.status(400).json({
      success: false,
      error: error.message,
      responseTime
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`EAS Validator Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Validation endpoint: POST http://localhost:${PORT}/validate`);
});
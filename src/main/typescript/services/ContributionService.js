/**
 * ContributionService - GitHub business logic and contribution processing
 * Implements the ContributionService gRPC interface defined in services.proto
 */

import { ethers } from 'ethers';
import SchemaConverter from '../utils/SchemaConverter.js';
import AttestService from './AttestService.js';
import SignService from './SignService.js';

class ContributionService {
    constructor() {
        this.converter = new SchemaConverter();
        this.attestService = new AttestService();
        this.signService = new SignService();
        
        // Configuration
        this.allowedRepositories = [
            'allenday/eas-attestor-github',
            'ethereum-attestation-service/eas-contracts'
        ];
    }

    /**
     * ValidateGist - Validate GitHub gist for identity registration
     * @param {Object} call - gRPC call object with gist validation data
     * @param {Function} callback - gRPC callback function
     */
    async ValidateGist(call, callback) {
        try {
            const { github_username, gist_url, ethereum_address } = call.request;

            if (!github_username || !gist_url || !ethereum_address) {
                return callback(new Error('GitHub username, gist URL, and Ethereum address are required'), null);
            }

            console.log(`🔍 Validating gist for ${github_username} -> ${ethereum_address}`);

            // Extract gist ID from URL
            const gistId = this.extractGistId(gist_url);
            if (!gistId) {
                return callback(new Error('Invalid gist URL format'), null);
            }

            // Fetch gist content from GitHub API
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EAS-Validator-Service/1.0'
                }
            });

            if (!response.ok) {
                let errorMessage = `GitHub API error: ${response.status}`;
                if (response.status === 404) {
                    errorMessage = 'Gist not found - please check the URL and ensure it\'s public';
                } else if (response.status === 403) {
                    errorMessage = 'GitHub API rate limit exceeded - please try again later';
                }
                return callback(new Error(errorMessage), null);
            }

            const gistData = await response.json();

            // Verify gist owner matches claimed GitHub username
            if (!gistData.owner || gistData.owner.login !== github_username) {
                return callback(new Error(`Gist owner mismatch: expected ${github_username}, found ${gistData.owner?.login}`), null);
            }

            // Get first file content
            const files = Object.values(gistData.files || {});
            if (files.length === 0) {
                return callback(new Error('Gist is empty - no files found'), null);
            }

            const firstFile = files[0];
            if (!firstFile.content) {
                return callback(new Error('Gist file has no content'), null);
            }

            // Parse verification data
            let verificationData;
            try {
                verificationData = JSON.parse(firstFile.content);
            } catch (parseError) {
                return callback(new Error('Gist does not contain valid JSON'), null);
            }

            // Validate required fields
            const requiredFields = ['github_username', 'address', 'signature', 'message'];
            for (const field of requiredFields) {
                if (!verificationData[field]) {
                    return callback(new Error(`Missing required field: ${field}`), null);
                }
            }

            // Verify fields match request
            if (verificationData.github_username !== github_username) {
                return callback(new Error('GitHub username in gist does not match claimed username'), null);
            }

            if (verificationData.address?.toLowerCase() !== ethereum_address.toLowerCase()) {
                return callback(new Error('Ethereum address in gist does not match provided address'), null);
            }

            // Verify signature
            try {
                const recoveredAddress = ethers.verifyMessage(verificationData.message, verificationData.signature);
                if (recoveredAddress.toLowerCase() !== ethereum_address.toLowerCase()) {
                    return callback(new Error('Signature verification failed - signature does not match Ethereum address'), null);
                }
            } catch (sigError) {
                return callback(new Error(`Signature verification failed: ${sigError.message}`), null);
            }

            console.log(`✅ Gist validation successful for ${github_username}`);

            callback(null, {
                is_valid: true,
                gist_id: gistId,
                verified_at: Math.floor(Date.now() / 1000),
                error: ''
            });

        } catch (error) {
            console.error('❌ ValidateGist failed:', error.message);
            callback(error, null);
        }
    }

    /**
     * ValidateRepositoryBranch - Validate GitHub branch for repository registration
     * @param {Object} call - gRPC call object with branch validation data
     * @param {Function} callback - gRPC callback function
     */
    async ValidateRepositoryBranch(call, callback) {
        try {
            const { repository_path, registrant_address, registrant_signature } = call.request;

            if (!repository_path || !registrant_address || !registrant_signature) {
                return callback(new Error('Repository path, registrant address, and registrant signature are required'), null);
            }

            console.log(`🔍 Validating repository branch for ${repository_path}`);

            // Verify the signature is valid for the expected message
            const expectedMessage = `github.com/${repository_path}`;
            try {
                const recoveredAddress = ethers.verifyMessage(expectedMessage, registrant_signature);
                if (recoveredAddress.toLowerCase() !== registrant_address.toLowerCase()) {
                    return callback(new Error('Signature verification failed - signature does not match registrant address'), null);
                }
            } catch (sigError) {
                return callback(new Error(`Invalid signature: ${sigError.message}`), null);
            }

            // Generate deterministic branch name from signature
            const branchName = this.generateBranchName(repository_path, registrant_signature);

            console.log(`🌿 Expected branch name: ${branchName}`);

            // Extract owner and repo from path
            const [owner, repo] = repository_path.split('/');
            if (!owner || !repo) {
                return callback(new Error('Invalid repository path format - expected owner/repo'), null);
            }

            // Check if branch exists via GitHub API
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branchName}`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EAS-Validator-Service/1.0'
                }
            });

            if (response.status === 404) {
                return callback(new Error(`Branch '${branchName}' not found. Please create this branch to prove repository write access.`), null);
            }

            if (!response.ok) {
                let errorMessage = `GitHub API error: ${response.status}`;
                if (response.status === 403) {
                    errorMessage = 'GitHub API rate limit exceeded - please try again later';
                }
                return callback(new Error(errorMessage), null);
            }

            const branchData = await response.json();

            console.log(`✅ Repository branch validation successful for ${repository_path}`);

            callback(null, {
                is_valid: true,
                branch_name: branchName,
                branch_sha: branchData.commit?.sha || '',
                verified_at: Math.floor(Date.now() / 1000),
                error: ''
            });

        } catch (error) {
            console.error('❌ ValidateRepositoryBranch failed:', error.message);
            callback(error, null);
        }
    }

    /**
     * GenerateRepositoryBranchName - Generate the required branch name for repository registration
     * @param {Object} call - gRPC call object with repository registration data
     * @param {Function} callback - gRPC callback function
     */
    async GenerateRepositoryBranchName(call, callback) {
        try {
            const { repository_path, registrant_signature } = call.request;

            if (!repository_path || !registrant_signature) {
                return callback(new Error('Repository path and registrant signature are required'), null);
            }

            // Generate deterministic branch name from signature
            const branchName = this.generateBranchName(repository_path, registrant_signature);
            
            // Extract message that should be signed
            const expectedMessage = `github.com/${repository_path}`;

            console.log(`🌿 Generated branch name for ${repository_path}: ${branchName}`);

            callback(null, {
                branch_name: branchName,
                repository_path: repository_path,
                expected_message: expectedMessage,
                generated_at: Math.floor(Date.now() / 1000)
            });

        } catch (error) {
            console.error('❌ GenerateRepositoryBranchName failed:', error.message);
            callback(error, null);
        }
    }

    /**
     * ProcessContribution - Process GitHub webhook contribution event
     * @param {Object} call - gRPC call object with contribution data
     * @param {Function} callback - gRPC callback function
     */
    async ProcessContribution(call, callback) {
        try {
            const { repository_full_name, event_type, action, contributor_username, contribution_url, commit_hash } = call.request;

            if (!repository_full_name || !event_type || !action || !contributor_username) {
                return callback(new Error('Repository, event type, action, and contributor are required'), null);
            }

            console.log(`🔄 Processing contribution:`, {
                repository: repository_full_name,
                contributor: contributor_username,
                type: event_type,
                action: action
            });

            // Check if repository is allowed
            if (!this.allowedRepositories.includes(repository_full_name)) {
                return callback(new Error(`Repository ${repository_full_name} not in allowlist`), null);
            }

            // Filter for high-value contributions
            if (!this.isHighValueContribution(event_type, action)) {
                return callback(null, {
                    success: true,
                    message: 'Contribution event not tracked (low value)',
                    attestation_uid: '',
                    transaction_hash: ''
                });
            }

            // Resolve contributor identity from GitHub username
            const { contributorAddress, identityAttestationUid } = await this.resolveContributorIdentity(contributor_username);
            
            if (contributorAddress === '0x0000000000000000000000000000000000000000') {
                console.warn(`⚠️ No identity attestation found for contributor: ${contributor_username}`);
            }

            // Determine schema based on contribution type
            let schemaKey;
            if (event_type === 'issues') {
                schemaKey = 'issue-contribution';
            } else if (event_type === 'pull_request') {
                schemaKey = 'pull-request-contribution';
            } else if (event_type === 'pull_request_review') {
                schemaKey = 'review-contribution';
            } else {
                return callback(new Error(`Unsupported contribution type: ${event_type}`), null);
            }

            // Prepare attestation data
            const attestationData = {
                domain: 'github.com',
                path: repository_full_name,
                contributor: contributorAddress,
                identityAttestationUid: identityAttestationUid,
                repositoryRegistrationUid: '0x0000000000000000000000000000000000000000000000000000000000000000', // TODO: lookup
                url: contribution_url,
                eventType: this.getEventTypeString(event_type, action) // This returns string format
            };

            // Add commit hash for PR contributions
            if (schemaKey === 'pull-request-contribution' && commit_hash) {
                attestationData.commitHash = commit_hash;
                attestationData.linkedIssueUids = []; // TODO: extract linked issues
            }

            // Add reviewed PR UID for review contributions
            if (schemaKey === 'review-contribution') {
                attestationData.reviewedPrUid = '0x0000000000000000000000000000000000000000000000000000000000000000'; // TODO: lookup
            }

            // Validate attestation data
            const validation = this.converter.validateJsonData(schemaKey, attestationData);
            if (!validation.isValid) {
                throw new Error(`Invalid attestation data: ${validation.errors.join(', ')}`);
            }

            // Create attestation request using converter (handles JSON->Ethereum conversion)
            const attestationRequest = this.converter.createAttestationRequest(
                schemaKey,
                attestationData,
                '0x0000000000000000000000000000000000000000', // No specific recipient
                { revocable: false }
            );

            const attestationResult = await new Promise((resolve, reject) => {
                this.attestService.CreateAttestation({ request: attestationRequest }, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });

            console.log(`✅ Contribution attestation created:`, attestationResult.transaction_hash);

            callback(null, {
                success: true,
                message: 'Contribution attestation created',
                attestation_uid: attestationResult.attestation_uid,
                transaction_hash: attestationResult.transaction_hash
            });

        } catch (error) {
            console.error('❌ ProcessContribution failed:', error.message);
            callback(error, null);
        }
    }

    /**
     * ResolveIdentity - Resolve contributor Ethereum address from GitHub username
     * @param {Object} call - gRPC call object with GitHub username
     * @param {Function} callback - gRPC callback function
     */
    async ResolveIdentity(call, callback) {
        try {
            const { github_username } = call.request;

            if (!github_username) {
                return callback(new Error('GitHub username is required'), null);
            }

            console.log(`🔍 Resolving identity for: ${github_username}`);

            const { contributorAddress, identityAttestationUid } = await this.resolveContributorIdentity(github_username);

            callback(null, {
                ethereum_address: contributorAddress,
                identity_attestation_uid: identityAttestationUid,
                found: contributorAddress !== '0x0000000000000000000000000000000000000000'
            });

        } catch (error) {
            console.error('❌ ResolveIdentity failed:', error.message);
            callback(error, null);
        }
    }

    // Helper methods

    /**
     * Extract gist ID from GitHub gist URL
     */
    extractGistId(gistUrl) {
        try {
            const url = new URL(gistUrl);
            const pathParts = url.pathname.split('/');
            return pathParts[pathParts.length - 1];
        } catch {
            return null;
        }
    }

    /**
     * Generate deterministic branch name for repository registration
     * Uses signature bytes to ensure deterministic but unpredictable names
     */
    generateBranchName(repositoryPath, registrantSignature) {
        // Use the signature bytes directly - take first 8 hex chars after 0x
        const sigBytes = registrantSignature.startsWith('0x') ? registrantSignature.substring(2) : registrantSignature;
        const shortHash = sigBytes.substring(0, 8); // First 8 hex chars from signature
        return `repository-registration-${shortHash}`;
    }

    /**
     * Check if contribution is high-value and should be attested
     */
    isHighValueContribution(eventType, action) {
        const highValueEvents = {
            'issues': ['closed'],
            'pull_request': ['merged'],
            'pull_request_review': ['submitted']
        };
        
        return highValueEvents[eventType]?.includes(action);
    }

    /**
     * Convert event type and action to standardized string
     */
    getEventTypeString(eventType, action) {
        if (eventType === 'issues') {
            return action === 'closed' ? 'ISSUE_EVENT_RESOLVED' : 'ISSUE_EVENT_OPENED';
        } else if (eventType === 'pull_request') {
            if (action === 'merged') return 'PR_EVENT_MERGED';
            if (action === 'closed') return 'PR_EVENT_CLOSED';
            return 'PR_EVENT_OPENED';
        } else if (eventType === 'pull_request_review') {
            return action === 'approved' ? 'REVIEW_EVENT_APPROVED' : 'REVIEW_EVENT_CHANGES_REQUESTED';
        }
        return 'UNKNOWN';
    }

    /**
     * Resolve contributor identity from GitHub username via EAS GraphQL
     */
    async resolveContributorIdentity(githubUsername) {
        try {
            console.log(`🔍 Resolving identity for GitHub user: ${githubUsername}`);
            
            // Query EAS GraphQL endpoint for identity attestations
            const easGraphqlUrl = 'https://base-sepolia.easscan.org/graphql';
            const identitySchemaUid = this.converter.getSchemaUID('identity');
            
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
            
            const response = await fetch(easGraphqlUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query, variables })
            });
            
            if (!response.ok) {
                throw new Error(`GraphQL request failed: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.errors) {
                throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
            }
            
            const attestations = result.data?.attestations || [];
            console.log(`📋 Found ${attestations.length} identity attestations`);
            
            // Find attestation for this specific GitHub username
            for (const attestation of attestations) {
                try {
                    const decodedData = JSON.parse(attestation.decodedDataJson);
                    
                    // Use converter to parse EAS GraphQL format to JSON
                    const identityData = this.converter.easGraphqlToJson('identity', decodedData);
                    
                    if (identityData.domain === 'github.com' && identityData.identifier === githubUsername) {
                        console.log(`✅ Found identity attestation for ${githubUsername}:`, attestation.id);
                        
                        return {
                            contributorAddress: attestation.recipient,
                            identityAttestationUid: attestation.id
                        };
                    }
                } catch (parseError) {
                    console.warn(`Failed to parse attestation data:`, parseError.message);
                    continue;
                }
            }
            
            console.log(`⚠️ No identity attestation found for GitHub user: ${githubUsername}`);
            
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
}

export default ContributionService;
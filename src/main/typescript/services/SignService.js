/**
 * SignService - Server-side cryptographic operations
 * Implements the SignService gRPC interface defined in services.proto
 */

import { ethers } from 'ethers';
import crypto from 'crypto';

class SignService {
    constructor() {
        this.wallet = null;
        this.initializeWallet();
    }

    /**
     * Initialize the server's wallet from environment variables
     */
    initializeWallet() {
        try {
            const privateKey = process.env.DEPLOY_CLOUD_STAGING_VALIDATOR_PRIVATE_KEY || 
                             process.env.DEPLOY_CLOUD_PROD_VALIDATOR_PRIVATE_KEY;
            
            if (!privateKey) {
                throw new Error('Validator private key not configured');
            }

            this.wallet = new ethers.Wallet(privateKey);
            console.log('🔐 SignService: Initialized with validator address:', this.wallet.address);

        } catch (error) {
            console.error('❌ SignService: Failed to initialize wallet:', error.message);
            throw error;
        }
    }

    /**
     * SignMessage - Sign a message using the server's private key
     * @param {Object} call - gRPC call object with message to sign
     * @param {Function} callback - gRPC callback function
     */
    async SignMessage(call, callback) {
        try {
            const { message } = call.request;

            if (!message) {
                return callback(new Error('Message is required'), null);
            }

            if (!this.wallet) {
                return callback(new Error('Wallet not initialized'), null);
            }

            console.log('🔐 Signing message:', message.substring(0, 100) + '...');

            // Sign the message
            const signature = await this.wallet.signMessage(message);

            console.log('✅ Message signed successfully');

            callback(null, {
                signature: signature,
                signer_address: this.wallet.address,
                message_hash: ethers.hashMessage(message)
            });

        } catch (error) {
            console.error('❌ SignMessage failed:', error.message);
            callback(error, null);
        }
    }

    /**
     * verifySignature - Verify a signature against a message and expected signer (REST version)
     * @param {Object} body - Request body with signature verification data
     * @returns {Promise<Object>} Verification response
     */
    async verifySignature({ body }) {
        try {
            const { message, signature, expected_signer } = body;

            if (!message || !signature) {
                throw new Error('Message and signature are required');
            }

            console.log('🔍 Verifying signature for message:', message.substring(0, 100) + '...');

            // Recover the signer address from the signature
            let recoveredAddress;
            try {
                recoveredAddress = ethers.verifyMessage(message, signature);
            } catch (verifyError) {
                return {
                    valid: false,
                    signer_address: '0x0000000000000000000000000000000000000000',
                    error: `Invalid signature: ${verifyError.message}`
                };
            }

            // Check if recovered address matches expected signer (if provided)
            let isValid = true;
            let errorMessage = null;

            if (expected_signer) {
                isValid = recoveredAddress.toLowerCase() === expected_signer.toLowerCase();
                if (!isValid) {
                    errorMessage = `Signature mismatch: expected ${expected_signer}, got ${recoveredAddress}`;
                }
            }

            console.log('✅ Signature verification complete:', { recoveredAddress, isValid });

            return {
                valid: isValid,
                signer_address: recoveredAddress,
                error: errorMessage || ''
            };

        } catch (error) {
            console.error('❌ verifySignature failed:', error.message);
            throw error;
        }
    }

    /**
     * GenerateWebhookSecret - Generate a deterministic webhook secret for a repository
     * @param {Object} call - gRPC call object with repository data
     * @param {Function} callback - gRPC callback function
     */
    async GenerateWebhookSecret(call, callback) {
        try {
            const { repository_full_name, registrant_signature } = call.request;

            if (!repository_full_name || !registrant_signature) {
                return callback(new Error('Repository full name and registrant signature are required'), null);
            }

            if (!this.wallet) {
                return callback(new Error('Wallet not initialized'), null);
            }

            console.log('🔐 Generating webhook secret for repository:', repository_full_name);

            // Create deterministic webhook secret using server private key
            const data = repository_full_name + registrant_signature + this.wallet.privateKey;
            const webhookSecret = ethers.keccak256(ethers.toUtf8Bytes(data));

            console.log('✅ Webhook secret generated successfully');

            callback(null, {
                webhook_secret: webhookSecret,
                repository_full_name: repository_full_name,
                validator_address: this.wallet.address
            });

        } catch (error) {
            console.error('❌ GenerateWebhookSecret failed:', error.message);
            callback(error, null);
        }
    }

    /**
     * ValidateWebhookSignature - Validate GitHub webhook signature
     * @param {Object} call - gRPC call object with webhook validation data
     * @param {Function} callback - gRPC callback function
     */
    async ValidateWebhookSignature(call, callback) {
        try {
            const { payload, signature, webhook_secret } = call.request;

            if (!payload || !signature || !webhook_secret) {
                return callback(new Error('Payload, signature, and webhook secret are required'), null);
            }

            console.log('🔍 Validating webhook signature');

            // Verify GitHub webhook signature
            let isValid = false;
            let errorMessage = null;

            try {
                if (!signature.startsWith('sha256=')) {
                    throw new Error('Invalid signature format - must start with sha256=');
                }

                const hmac = crypto.createHmac('sha256', webhook_secret);
                hmac.update(payload);
                const expectedSignature = 'sha256=' + hmac.digest('hex');

                isValid = crypto.timingSafeEqual(
                    Buffer.from(signature),
                    Buffer.from(expectedSignature)
                );

                if (!isValid) {
                    errorMessage = 'Webhook signature mismatch';
                }

            } catch (validationError) {
                errorMessage = `Signature validation error: ${validationError.message}`;
            }

            console.log('✅ Webhook signature validation complete:', { isValid });

            callback(null, {
                is_valid: isValid,
                error: errorMessage || ''
            });

        } catch (error) {
            console.error('❌ ValidateWebhookSignature failed:', error.message);
            callback(error, null);
        }
    }

    /**
     * getServerAddress - Return the server's Ethereum address (REST version)
     * @returns {Promise<Object>} Server address response
     */
    async getServerAddress() {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized');
            }

            console.log('📍 Returning server address:', this.wallet.address);

            return {
                address: this.wallet.address
            };

        } catch (error) {
            console.error('❌ getServerAddress failed:', error.message);
            throw error;
        }
    }

    /**
     * serverSignAttestation - Server signs attestation using private key (REST version)
     * @param {Object} body - Request body with attestation data
     * @returns {Promise<Object>} Attestation response
     */
    async serverSignAttestation({ body }) {
        try {
            const { schema_type, data, recipient, revocable, expiration_time } = body;
            
            console.log('🔐 Server signing attestation:', {
                schema_type,
                recipient,
                expiration_time,
                revocable
            });

            if (!this.wallet) {
                throw new Error('Wallet not initialized');
            }

            // TODO: Implement actual EAS attestation creation
            // This is a placeholder - would need to integrate with EAS SDK
            const mockAttestationUid = ethers.keccak256(ethers.toUtf8Bytes(
                JSON.stringify({ schema_type, data, recipient, timestamp: Date.now() })
            ));
            const mockTxHash = ethers.keccak256(ethers.toUtf8Bytes(
                `tx-${mockAttestationUid}-${Date.now()}`
            ));

            console.log('✅ Server attestation signed:', {
                attestation_uid: mockAttestationUid,
                transaction_hash: mockTxHash,
                attester: this.wallet.address
            });

            return {
                attestation_uid: mockAttestationUid,
                transaction_hash: mockTxHash,
                attester: this.wallet.address
            };

        } catch (error) {
            console.error('❌ serverSignAttestation failed:', error.message);
            throw error;
        }
    }
}

export default SignService;
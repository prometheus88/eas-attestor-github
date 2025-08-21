/**
 * AttestService - Generic schema operations for EAS attestations
 * Implements the AttestService gRPC interface defined in services.proto
 */

import { ethers } from 'ethers';
import SchemaConverter from '../utils/SchemaConverter.js';

class AttestService {
    constructor() {
        this.converter = new SchemaConverter();
    }

    /**
     * CreateAttestation - Create a new EAS attestation
     * @param {Object} call - gRPC call object with request data
     * @param {Function} callback - gRPC callback function
     */
    async CreateAttestation(call, callback) {
        try {
            const { schema_uid, recipient, expiration_time, revocable, data } = call.request;
            
            console.log('📝 Creating attestation:', {
                schema_uid,
                recipient,
                expiration_time,
                revocable
            });

            // Get private key from environment
            const privateKey = process.env.DEPLOY_CLOUD_STAGING_VALIDATOR_PRIVATE_KEY || 
                             process.env.DEPLOY_CLOUD_PROD_VALIDATOR_PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('Validator private key not configured');
            }

            // Setup provider and wallet
            const rpcUrl = process.env.NODE_ENV === 'production' 
                ? 'https://mainnet.base.org' 
                : 'https://sepolia.base.org';
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const wallet = new ethers.Wallet(privateKey, provider);

            // EAS contract address
            const easAddress = '0x4200000000000000000000000000000000000021'; // Base Sepolia
            
            // Create EAS contract interface
            const easAbi = [
                "function attest((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data) request) returns (bytes32)"
            ];
            const easContract = new ethers.Contract(easAddress, easAbi, wallet);

            // Create attestation request
            const attestationRequest = {
                schema: schema_uid,
                data: {
                    recipient: recipient || wallet.address,
                    expirationTime: expiration_time || 0,
                    revocable: revocable || true,
                    refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    data: data || '0x',
                    value: 0
                }
            };

            // Submit attestation to EAS
            const tx = await easContract.attest(attestationRequest);
            const receipt = await tx.wait();

            console.log('✅ Attestation created:', {
                txHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString()
            });

            callback(null, {
                success: true,
                attestation_uid: receipt.hash, // This would be extracted from logs in real implementation
                transaction_hash: receipt.hash,
                gas_used: receipt.gasUsed.toString(),
                block_number: receipt.blockNumber
            });

        } catch (error) {
            console.error('❌ CreateAttestation failed:', error.message);
            callback(error, null);
        }
    }

    /**
     * GetSchemas - Return all available schema definitions
     * @param {Object} call - gRPC call object
     * @param {Function} callback - gRPC callback function
     */
    async GetSchemas(call, callback) {
        try {
            const schemaKeys = this.converter.getAvailableSchemas();
            const schemaList = schemaKeys.map(key => {
                const metadata = this.converter.getSchemaMetadata(key);
                return {
                    schema_uid: metadata.uid,
                    name: metadata.name,
                    definition: metadata.definition,
                    description: metadata.description
                };
            });

            console.log(`📋 Retrieved ${schemaList.length} schemas`);

            callback(null, {
                schemas: schemaList
            });

        } catch (error) {
            console.error('❌ GetSchemas failed:', error.message);
            callback(error, null);
        }
    }

    /**
     * GetSchema - Return specific schema definition by UID
     * @param {Object} call - gRPC call object with schema_uid
     * @param {Function} callback - gRPC callback function
     */
    async GetSchema(call, callback) {
        try {
            const { schema_uid } = call.request;
            
            const schemaKey = this.converter.findSchemaByUID(schema_uid);
            const metadata = this.converter.getSchemaMetadata(schemaKey);

            console.log(`📋 Retrieved schema: ${metadata.name}`);

            callback(null, {
                schema_uid: metadata.uid,
                name: metadata.name,
                definition: metadata.definition,
                description: metadata.description
            });

        } catch (error) {
            console.error('❌ GetSchema failed:', error.message);
            callback(error, null);
        }
    }

    /**
     * Helper method to encode schema data dynamically
     * @param {string} schemaKey - Key identifying the schema
     * @param {Object} data - Data to encode
     * @returns {Object} - Encoded data with schema UID
     */
    encodeSchemaData(schemaKey, data) {
        return this.converter.jsonToEthereum(schemaKey, data);
    }

    /**
     * Helper method to create EAS attestation request
     * @param {string} schemaKey - Key identifying the schema
     * @param {Object} data - Data to encode
     * @param {string} recipient - Recipient address
     * @param {Object} options - Additional options
     * @returns {Object} - EAS attestation request
     */
    createAttestationRequest(schemaKey, data, recipient = null, options = {}) {
        return this.converter.createAttestationRequest(schemaKey, data, recipient, options);
    }
}

export default AttestService;
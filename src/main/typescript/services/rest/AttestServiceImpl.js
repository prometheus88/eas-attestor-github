/**
 * AttestService REST Implementation - Direct CommonJS version
 * Implementation of the AttestService interface for REST endpoints
 */

const Service = require('./Service');

class AttestServiceImpl {
    constructor() {
        // Mock schema data
        this.schemas = {
            "repository-registration": {
                name: "Repository Registration",
                definition: "string repository_full_name,string registrant_signature,address registrant",
                description: "Schema for registering repositories with the attestation service"
            },
            "identity": {
                name: "Identity Registration", 
                definition: "string github_username,string gist_url,address ethereum_address,string validation_signature",
                description: "Schema for linking GitHub identities to Ethereum addresses"
            },
            "contribution": {
                name: "Contribution Record",
                definition: "string contribution_type,string repository,string github_username,string contribution_hash,uint64 timestamp",
                description: "Schema for recording GitHub contributions"
            }
        };
    }

    async createAttestation({ body }) {
        try {
            const { schema_type, data, recipient, revocable, expiration_time } = body;
            
            console.log('📝 Creating attestation:', {
                schema_type,
                recipient,
                expiration_time,
                revocable
            });

            // Mock attestation creation
            const mockAttestationUid = `0x${Math.random().toString(16).substr(2, 64)}`;
            const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;

            return {
                attestation_uid: mockAttestationUid,
                transaction_hash: mockTxHash,
                attester: "0x742d35Cc6634C0532925a3b8D62F1C9134F7e1be"
            };

        } catch (error) {
            console.error('❌ createAttestation failed:', error.message);
            throw error;
        }
    }

    async getSchemas() {
        try {
            console.log('📋 Retrieved schemas');
            
            return {
                schemas: this.schemas,
                deployments: [
                    {
                        contract_name: "EAS",
                        contract_address: "0x4200000000000000000000000000000000000021"
                    }
                ]
            };

        } catch (error) {
            console.error('❌ getSchemas failed:', error.message);
            throw error;
        }
    }

    async getSchema({ path: { schema_type } }) {
        try {
            const schema = this.schemas[schema_type];
            
            if (!schema) {
                throw new Error(`Schema not found: ${schema_type}`);
            }

            console.log('📋 Retrieved schema:', schema_type);

            return {
                schema: schema,
                deployment: {
                    contract_name: "EAS",
                    contract_address: "0x4200000000000000000000000000000000000021"
                }
            };

        } catch (error) {
            console.error('❌ getSchema failed:', error.message);
            throw error;
        }
    }
}

const attestServiceInstance = new AttestServiceImpl();

const createAttestation = ({ body }) => new Promise(async (resolve, reject) => {
    try {
        const result = await attestServiceInstance.createAttestation({ body });
        resolve(Service.successResponse(result));
    } catch (e) {
        reject(Service.rejectResponse(
            e.message || 'Invalid input',
            e.status || 500,
        ));
    }
});

const getSchemas = () => new Promise(async (resolve, reject) => {
    try {
        const result = await attestServiceInstance.getSchemas();
        resolve(Service.successResponse(result));
    } catch (e) {
        reject(Service.rejectResponse(
            e.message || 'Invalid input',
            e.status || 500,
        ));
    }
});

const getSchema = ({ path }) => new Promise(async (resolve, reject) => {
    try {
        const result = await attestServiceInstance.getSchema({ path });
        resolve(Service.successResponse(result));
    } catch (e) {
        reject(Service.rejectResponse(
            e.message || 'Invalid input',
            e.status || 500,
        ));
    }
});

module.exports = {
    createAttestation,
    getSchemas,
    getSchema,
};
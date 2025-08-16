// Configuration for the EAS Attestor application
// BUILD_TIME_CONFIG_INJECTION
window.EAS_CONFIG = {
    // GitHub URLs
    github: {
        domain: 'github.com',
        baseUrl: 'https://github.com',
        gistUrl: 'https://gist.github.com',
        apiUrl: 'https://api.github.com'
    },
    
    // Project URLs (can be overridden for different deployments)
    project: {
        repository: 'https://github.com/allenday/contributor-attestation-service',
        documentation: 'https://github.com/allendy/contributor-attestation-service/blob/main/README.md'
    },
    
    // EAS Contract addresses on Base networks
    contracts: {
        'base-sepolia': {
            eas: '0x4200000000000000000000000000000000000021',
            schemaRegistry: '0x4200000000000000000000000000000000000020'
        },
        'base': {
            eas: '0x4200000000000000000000000000000000000021', 
            schemaRegistry: '0x4200000000000000000000000000000000000020'
        }
    },
    
    // Chain IDs
    chainIds: {
        'base-sepolia': 84532,
        'base': 8453
    },
    
    // Schema for validated domain identifier to Ethereum address attestation
    attestationSchemaUid: "0xe5daad34f7c6c87eb60d2d32bde166ff4b87c8d165a95af58a93e774fc28c96e",
    
    // Our known validator address
    validatorAddress: "0xCD57460f69Bc442BF4A6A90cD615BdE4232122DB",
    
    // API endpoints
    api: {
        graphql: {
            'base-sepolia': 'https://base-sepolia.easscan.org/graphql',
            'base': 'https://base.easscan.org/graphql'
        },
        validator: {
            local: 'http://localhost:8080',
            getEndpoint: function() {
                // Check for environment-specific override (set via build/deployment)
                if (window.EAS_VALIDATOR_URL) {
                    return window.EAS_VALIDATOR_URL;
                }
                
                // Check if we're in local development
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    return this.local;
                }
                
                // For production deployments, the validator URL should be provided
                // via build-time environment variables or deployment configuration
                console.warn('No validator endpoint configured. Set window.EAS_VALIDATOR_URL or configure deployment.');
                return null;
            }
        }
    }
};
// Configuration for the EAS Attestor application
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
            local: 'http://localhost:6001',
            production: '/api'  // Will be set based on deployment
        }
    }
};
// Configuration for the EAS Attestor React application
// Ported from main/html/config.js

export interface EASConfig {
  github: {
    domain: string
    baseUrl: string
    gistUrl: string
    apiUrl: string
  }
  project: {
    repository: string
    documentation: string
  }
  contracts: {
    [network: string]: {
      eas: string
      schemaRegistry: string
    }
  }
  chainIds: {
    [network: string]: number
  }
  attestationSchemaUid: string
  validatorAddresses: string[]
  api: {
    graphql: {
      [network: string]: string
    }
    validator: {
      local: string
      getEndpoint: () => string | null
    }
  }
}

export const EAS_CONFIG: EASConfig = {
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
  
  // Our known trusted validator addresses
  validatorAddresses: [
    "0xCD57460f69Bc442BF4A6A90cD615BdE4232122DB", // Original validator
    "0xcc084f7a8d127c5f56c6293852609c9fee7b27ed"  // Second trusted validator
  ],
  
  // API endpoints
  api: {
    graphql: {
      'base-sepolia': 'https://base-sepolia.easscan.org/graphql',
      'base': 'https://base.easscan.org/graphql'
    },
    validator: {
      local: 'http://localhost:6001',
      getEndpoint: function(): string {
        // Check for build-time environment variable (Vite)
        if (import.meta.env.VITE_VALIDATOR_URL) {
          return import.meta.env.VITE_VALIDATOR_URL;
        }
        
        // Check for runtime environment-specific override (legacy support)
        if (typeof window !== 'undefined' && (window as any).EAS_VALIDATOR_URL) {
          return (window as any).EAS_VALIDATOR_URL;
        }
        
        // Dynamic environment detection based on hostname
        if (typeof window !== 'undefined') {
          const hostname = window.location.hostname;
          
          // Local development
          if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return this.local;
          }
          
          // Staging environment
          if (hostname.includes('staging')) {
            return window.location.origin;
          }
          
          // Production environment
          if (hostname.includes('eas.') || import.meta.env.VITE_ENVIRONMENT === 'production') {
            return window.location.origin;
          }
        }
        
        // Fallback
        return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:6001';
      }
    }
  }
}

// Network helper functions
export const getNetworkName = (chainId: number): string => {
  switch (chainId) {
    case 8453:
      return 'base'
    case 84532:
      return 'base-sepolia'
    default:
      return 'unknown'
  }
}

export const getDefaultNetwork = (): string => {
  // Check build-time environment variable
  if (import.meta.env.VITE_NETWORK) {
    return import.meta.env.VITE_NETWORK;
  }
  
  // Check build-time environment
  if (import.meta.env.VITE_ENVIRONMENT === 'production') {
    return 'base';
  }
  
  // Default to staging network
  return 'base-sepolia';
}

export const getGraphQLEndpoint = (network: string): string => {
  // In development, use proxy to avoid CORS issues
  if (typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    const proxyEndpoints = {
      'base': '/api/base-mainnet/graphql',
      'base-sepolia': '/api/base-sepolia/graphql'
    }
    return proxyEndpoints[network as keyof typeof proxyEndpoints] || proxyEndpoints['base-sepolia']
  }
  
  // In production, use direct endpoints
  return EAS_CONFIG.api.graphql[network] || EAS_CONFIG.api.graphql['base-sepolia']
}

export const getBlockExplorerUrl = (network: string, txHash: string): string => {
  const baseUrls = {
    'base': 'https://basescan.org',
    'base-sepolia': 'https://sepolia.basescan.org'
  }
  const baseUrl = baseUrls[network as keyof typeof baseUrls] || baseUrls['base-sepolia']
  return `${baseUrl}/tx/${txHash}`
}
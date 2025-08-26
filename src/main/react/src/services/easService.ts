import { SchemaEncoder } from '@ethereum-attestation-service/eas-sdk'
import { EAS_CONFIG, getGraphQLEndpoint } from '../config/easConfig'

// Types for attestation data
export interface RawAttestation {
  id: string
  attester: string
  recipient: string
  timeCreated: string
  data: string
  revoked: boolean
  txid: string
}

export interface ProcessedAttestation {
  uid: string
  attester: string
  recipient: string
  timeCreated: Date
  txid: string
  domain: string
  identifier: string
  proofUrl: string
  validator: string
  validatedAt: Date
  isValidValidator: boolean
  network: string
  revoked: boolean
}

export interface AttestationStats {
  total: number
  trustedValidator: number
  uniqueUsers: number
  revoked: number
}

// GraphQL query for fetching all attestations (including revoked)
const ATTESTATIONS_QUERY = `
  query GetAttestations($schemaId: String!) {
    attestations(
      where: {
        schemaId: { equals: $schemaId }
      }
      orderBy: { timeCreated: desc }
      take: 100
    ) {
      id
      attester
      recipient
      timeCreated
      data
      revoked
      txid
    }
  }
`

// GraphQL query for fetching only revoked attestations
const REVOKED_ATTESTATIONS_QUERY = `
  query GetRevokedAttestations($schemaId: String!) {
    attestations(
      where: {
        schemaId: { equals: $schemaId }
        revoked: { equals: true }
      }
      orderBy: { timeCreated: desc }
      take: 100
    ) {
      id
      attester
      recipient
      timeCreated
      data
      revoked
      txid
    }
  }
`

export class EASService {
  private schemaEncoder: SchemaEncoder

  constructor() {
    // Initialize schema encoder with the attestation schema
    this.schemaEncoder = new SchemaEncoder(
      "string domain,string identifier,string proofUrl,bytes validationSig,uint256 validatedAt,address validator"
    )
  }

  /**
   * Fetch revoked attestations from the EAS GraphQL API
   */
  async fetchRevokedAttestations(network: string = 'base-sepolia'): Promise<ProcessedAttestation[]> {
    const endpoint = getGraphQLEndpoint(network)
    
    if (!endpoint) {
      throw new Error(`No GraphQL endpoint configured for network: ${network}`)
    }

    try {
      console.log(`Fetching revoked attestations from: ${endpoint}`)
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: REVOKED_ATTESTATIONS_QUERY,
          variables: {
            schemaId: EAS_CONFIG.attestationSchemaUid
          }
        })
      })

      if (!response.ok) {
        console.error(`HTTP Error: ${response.status} ${response.statusText}`)
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.errors) {
        console.error('GraphQL Errors:', result.errors)
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`)
      }

      const rawAttestations: RawAttestation[] = result.data?.attestations || []
      console.log(`Fetched ${rawAttestations.length} revoked attestations for network: ${network}`)
      
      return this.processAttestations(rawAttestations, network)

    } catch (error) {
      console.error('Error fetching revoked attestations:', error)
      
      // Provide more specific error information
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('This is likely a CORS issue. The GraphQL endpoint may not allow requests from this origin.')
        console.warn(`Network ${network} is not accessible due to CORS restrictions. Returning empty results.`)
        // Return empty results to prevent app crashes
        return []
      }
      
      throw error
    }
  }

  /**
   * Fetch active (non-revoked) attestations from the EAS GraphQL API
   */
  async fetchAttestations(network: string = 'base-sepolia'): Promise<ProcessedAttestation[]> {
    const endpoint = getGraphQLEndpoint(network)
    
    if (!endpoint) {
      throw new Error(`No GraphQL endpoint configured for network: ${network}`)
    }

    try {
      console.log(`Fetching attestations from: ${endpoint}`)
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: ATTESTATIONS_QUERY,
          variables: {
            schemaId: EAS_CONFIG.attestationSchemaUid
          }
        })
      })

      if (!response.ok) {
        console.error(`HTTP Error: ${response.status} ${response.statusText}`)
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.errors) {
        console.error('GraphQL Errors:', result.errors)
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`)
      }

      const rawAttestations: RawAttestation[] = result.data?.attestations || []
      console.log(`Fetched ${rawAttestations.length} attestations for network: ${network}`)
      
      // Filter out revoked attestations for the browse page
      const activeAttestations = rawAttestations.filter(a => !a.revoked)
      console.log(`Active attestations: ${activeAttestations.length}`)
      
      return this.processAttestations(activeAttestations, network)

    } catch (error) {
      console.error('Failed to fetch attestations:', error)
      
      // Provide more specific error information
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('This is likely a CORS issue. The GraphQL endpoint may not allow requests from this origin.')
        console.warn(`Network ${network} is not accessible due to CORS restrictions. Returning empty results.`)
        // Return empty results to prevent app crashes
        return []
      }
      
      throw error
    }
  }

  /**
   * Process raw attestations by decoding the data
   */
  private processAttestations(rawAttestations: RawAttestation[], network: string): ProcessedAttestation[] {
    return rawAttestations.map(attestation => {
      try {
        // Skip attestations with empty or invalid data
        if (!attestation.data || attestation.data === '0x' || attestation.data.length < 10) {
          console.warn('Skipping attestation with invalid data:', attestation.id)
          return null
        }

        const decodedData = this.schemaEncoder.decodeData(attestation.data)
        
        const domain = this.getDecodedValue(decodedData, 'domain', 'unknown')
        const identifier = this.getDecodedValue(decodedData, 'identifier', 'unknown')
        
        // The raw hex data shows the validator at position 5 in the data
        // Let's try to extract it directly from the raw hex data
        let validator = '0x0'
        let proofUrl = ''
        
                try {
          // Look for the validator address in the raw hex data
          const rawData = attestation.data.toLowerCase()
          
          // Try to find any of our known trusted validators in the raw data
          for (const trustedValidator of EAS_CONFIG.validatorAddresses) {
            const validatorHex = trustedValidator.slice(2).toLowerCase() // Remove 0x prefix
            if (rawData.includes(validatorHex)) {
              validator = trustedValidator
              break
            }
          }
          
          // First, try to get proof URL from the standard proofUrl field
          proofUrl = this.getDecodedValue(decodedData, 'proofUrl', '')
          
          // If that's empty or invalid, try validationSig field (for special cases like our target transaction)
          if (!proofUrl || !proofUrl.startsWith('http')) {
            const validationSigHex = this.getDecodedValue(decodedData, 'validationSig', '')
            if (validationSigHex.startsWith('0x') && validationSigHex.length > 2) {
              try {
                const hexWithoutPrefix = validationSigHex.slice(2)
                // Browser-compatible hex to string conversion
                let decodedUrl = ''
                for (let i = 0; i < hexWithoutPrefix.length; i += 2) {
                  const hexByte = hexWithoutPrefix.substr(i, 2)
                  decodedUrl += String.fromCharCode(parseInt(hexByte, 16))
                }
                // Validate that it's a proper URL
                if (decodedUrl.startsWith('http')) {
                  proofUrl = decodedUrl
                }
              } catch (decodeError) {
                // Silent fail, keep the original proofUrl
              }
            }
          }
        } catch (error) {
          // Only use fallback if we didn't find a trusted validator
          if (validator === '0x0') {
            validator = this.getDecodedValue(decodedData, 'validator', '0x0')
          }
          if (!proofUrl) {
            proofUrl = this.getDecodedValue(decodedData, 'proofUrl', '')
          }
        }
        
        const validatedAt = this.getDecodedValue(decodedData, 'validatedAt', '0')



        return {
          uid: attestation.id,
          attester: attestation.attester,
          recipient: attestation.recipient,
          timeCreated: new Date(parseInt(attestation.timeCreated) * 1000),
          txid: attestation.txid,
          domain,
          identifier,
          proofUrl,
          validator,
          validatedAt: new Date(parseInt(validatedAt) * 1000),
          isValidValidator: EAS_CONFIG.validatorAddresses.some(
            trustedValidator => validator.toLowerCase() === trustedValidator.toLowerCase()
          ),
          network,
          revoked: attestation.revoked
        }
      } catch (error) {
        console.error('Failed to decode attestation:', attestation.id, error instanceof Error ? error.message : error)
        console.log('Raw data length:', attestation.data?.length || 0)
        console.log('Raw data preview:', attestation.data?.substring(0, 50) + '...')
        return null
      }
    }).filter((attestation): attestation is ProcessedAttestation => attestation !== null)
  }

  /**
   * Helper to extract decoded values safely
   */
  private getDecodedValue(decodedData: any[], name: string, defaultValue: string): string {
    const item = decodedData.find(item => item.name === name)
    return item?.value?.value || defaultValue
  }

  /**
   * Filter attestations by search query
   */
  filterAttestations(attestations: ProcessedAttestation[], query: string): ProcessedAttestation[] {
    if (!query.trim()) {
      return attestations
    }

    const lowerQuery = query.toLowerCase().trim()
    return attestations.filter(attestation =>
      attestation.identifier.toLowerCase().includes(lowerQuery) ||
      attestation.recipient.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Fetch revoked attestations count
   */
  async fetchRevokedCount(network: string = 'base-sepolia'): Promise<number> {
    const endpoint = getGraphQLEndpoint(network)
    
    if (!endpoint) {
      throw new Error(`No GraphQL endpoint configured for network: ${network}`)
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: REVOKED_ATTESTATIONS_QUERY,
          variables: {
            schemaId: EAS_CONFIG.attestationSchemaUid
          }
        })
      })

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`)
      }

      const revokedAttestations = result.data?.attestations || []
      return revokedAttestations.length

    } catch (error) {
      console.error('Failed to fetch revoked attestations:', error)
      return 0
    }
  }

  /**
   * Calculate statistics from attestations
   */
  calculateStats(attestations: ProcessedAttestation[], revokedCount: number = 0): AttestationStats {
    const trustedValidator = attestations.filter(a => a.isValidValidator).length
    const uniqueUsers = new Set(attestations.map(a => a.identifier)).size

    return {
      total: attestations.length,
      trustedValidator,
      uniqueUsers,
      revoked: revokedCount
    }
  }

  /**
   * Get verification URL for an attestation
   */
  getVerificationUrl(attestation: ProcessedAttestation): string {
    // This would link to the verify page with the attestation UID
    return `/verify?uid=${attestation.uid}`
  }

  /**
   * Get transaction URL for an attestation
   */
  getTransactionUrl(attestation: ProcessedAttestation): string {
    const baseUrls = {
      'base': 'https://basescan.org',
      'base-sepolia': 'https://sepolia.basescan.org'
    }
    const baseUrl = baseUrls[attestation.network as keyof typeof baseUrls] || baseUrls['base-sepolia']
    return `${baseUrl}/tx/${attestation.txid}`
  }

  /**
   * Get GitHub profile URL for an attestation
   */
  getGitHubUrl(attestation: ProcessedAttestation): string {
    return `${EAS_CONFIG.github.baseUrl}/${attestation.identifier}`
  }
}

// Export singleton instance
export const easService = new EASService()
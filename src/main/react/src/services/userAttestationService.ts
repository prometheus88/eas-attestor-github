// Service for discovering and managing user's attestations
import { SchemaEncoder } from '@ethereum-attestation-service/eas-sdk'
// import { ethers } from 'ethers'
import { EAS_CONFIG } from '../config/easConfig'
import { UserAttestation, EASAttestationData } from '../types/revocationTypes'

// Identity schema definition for decoding attestation data
const IDENTITY_SCHEMA_DEFINITION = "string domain,string identifier,address ethereumAddress,string proofUrl,address validator,bytes validationSignature"

class UserAttestationService {
  private graphqlEndpoints = EAS_CONFIG.api.graphql
  
  /**
   * Get GraphQL endpoint for network
   */
  private getGraphQLEndpoint(network: string): string {
    return this.graphqlEndpoints[network] || this.graphqlEndpoints['base-sepolia']
  }

  /**
   * Query user's attestations from EAS subgraph
   */
  private async queryUserAttestations(walletAddress: string, network: string): Promise<EASAttestationData[]> {
    const endpoint = this.getGraphQLEndpoint(network)
    const schemaUID = EAS_CONFIG.attestationSchemaUid

    const query = `
      query GetUserAttestations($where: AttestationWhereInput!, $take: Int!) {
        attestations(
          where: $where,
          take: $take,
          orderBy: [{ time: desc }]
        ) {
          id
          attester
          recipient
          revoked
          revocationTime
          expirationTime
          time
          data
          schema {
            id
          }
          refUID
          txid
        }
      }
    `

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            where: {
              attester: { equals: walletAddress }, // Keep original case
              schema: { is: { id: { equals: schemaUID } } }
            },
            take: 100
          }
        })
      })

      if (!response.ok) {
        throw new Error(`GraphQL query failed: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map((e: any) => e.message).join(', ')}`)
      }

      return result.data?.attestations || []
    } catch (error) {
      console.error(`Failed to query attestations for ${network}:`, error)
      return []
    }
  }

  /**
   * Decode attestation data using schema
   */
  private decodeAttestationData(encodedData: string): {
    domain: string
    identifier: string
    ethereumAddress: string
    proofUrl: string
    validator: string
    validationSignature: string
  } {
    try {
      const schemaEncoder = new SchemaEncoder(IDENTITY_SCHEMA_DEFINITION)
      const decodedData = schemaEncoder.decodeData(encodedData)
      
      const getValue = (name: string): string => {
        const item = decodedData.find(item => item.name === name)
        return item?.value?.value?.toString() || ''
      }

      return {
        domain: getValue('domain'),
        identifier: getValue('identifier'),
        ethereumAddress: getValue('ethereumAddress'),
        proofUrl: getValue('proofUrl'),
        validator: getValue('validator'),
        validationSignature: getValue('validationSignature')
      }
    } catch (error) {
      console.error('Failed to decode attestation data:', error)
      return {
        domain: 'unknown',
        identifier: 'unknown',
        ethereumAddress: '0x0',
        proofUrl: '',
        validator: '0x0',
        validationSignature: '0x'
      }
    }
  }

  /**
   * Check if validator is trusted
   */
  private isValidatorTrusted(validatorAddress: string): boolean {
    const normalizedValidator = validatorAddress.toLowerCase()
    const trustedValidators = EAS_CONFIG.validatorAddresses.map(addr => addr.toLowerCase())
    return trustedValidators.includes(normalizedValidator)
  }

  /**
   * Convert EAS data to UserAttestation
   */
  private convertToUserAttestation(
    easData: EASAttestationData, 
    networkName: string
  ): UserAttestation {
    const decodedData = this.decodeAttestationData(easData.data)
    const isValidValidator = this.isValidatorTrusted(decodedData.validator)

    return {
      uid: easData.id,
      attester: easData.attester,
      recipient: easData.recipient,
      revoked: easData.revoked,
      revocationTime: BigInt(easData.revocationTime || '0'),
      expirationTime: BigInt(easData.expirationTime || '0'),
      time: BigInt(easData.time),
      data: easData.data,
      schema: easData.schema.id,
      refUID: easData.refUID,
      txHash: easData.txid,
      networkName,
      isValidValidator,
      // Decoded data
      domain: decodedData.domain,
      identifier: decodedData.identifier,
      ethereumAddress: decodedData.ethereumAddress,
      proofUrl: decodedData.proofUrl,
      validator: decodedData.validator,
      validationSignature: decodedData.validationSignature
    }
  }

  /**
   * Get all user attestations across supported networks
   */
  async getUserAttestations(walletAddress: string): Promise<UserAttestation[]> {
    if (!walletAddress) {
      throw new Error('Wallet address is required')
    }

    const networks = Object.keys(EAS_CONFIG.contracts)
    const allAttestations: UserAttestation[] = []

    // Query all networks in parallel
    const networkPromises = networks.map(async (network) => {
      try {
        const easData = await this.queryUserAttestations(walletAddress, network)
        return easData.map(data => this.convertToUserAttestation(data, network))
      } catch (error) {
        console.error(`Failed to get attestations for ${network}:`, error)
        return []
      }
    })

    const networkResults = await Promise.all(networkPromises)
    
    // Flatten and sort by creation time (newest first)
    networkResults.forEach(attestations => {
      allAttestations.push(...attestations)
    })

    // Sort by creation time (newest first)
    allAttestations.sort((a, b) => {
      const timeA = Number(a.time)
      const timeB = Number(b.time)
      return timeB - timeA
    })

    return allAttestations
  }

  /**
   * Get revokable attestations only (active, non-expired, user is attester)
   */
  async getRevokableAttestations(walletAddress: string): Promise<UserAttestation[]> {
    const allAttestations = await this.getUserAttestations(walletAddress)
    const now = Math.floor(Date.now() / 1000)

    return allAttestations.filter(attestation => {
      // Must not be already revoked
      if (attestation.revoked) return false
      
      // Must not be expired (if expiration is set)
      if (attestation.expirationTime > 0 && Number(attestation.expirationTime) < now) {
        return false
      }
      
      // User must be the attester to revoke
      if (attestation.attester.toLowerCase() !== walletAddress.toLowerCase()) {
        return false
      }

      return true
    })
  }

  /**
   * Search attestations by UID or transaction hash
   */
  searchAttestations(
    attestations: UserAttestation[],
    searchQuery: string
  ): UserAttestation[] {
    if (!searchQuery.trim()) {
      return attestations
    }

    const query = searchQuery.toLowerCase().trim()
    
    return attestations.filter(attestation => {
      return (
        attestation.uid.toLowerCase().includes(query) ||
        attestation.txHash.toLowerCase().includes(query) ||
        attestation.identifier.toLowerCase().includes(query)
      )
    })
  }

  /**
   * Filter attestations by network
   */
  filterByNetwork(
    attestations: UserAttestation[],
    networkFilter: string
  ): UserAttestation[] {
    if (networkFilter === 'all') {
      return attestations
    }
    
    return attestations.filter(attestation => 
      attestation.networkName === networkFilter
    )
  }

  /**
   * Filter attestations by status
   */
  filterByStatus(
    attestations: UserAttestation[],
    statusFilter: 'all' | 'active' | 'revoked'
  ): UserAttestation[] {
    if (statusFilter === 'all') {
      return attestations
    }
    
    if (statusFilter === 'active') {
      return attestations.filter(attestation => !attestation.revoked)
    }
    
    if (statusFilter === 'revoked') {
      return attestations.filter(attestation => attestation.revoked)
    }
    
    return attestations
  }

  /**
   * Filter attestations by trust level
   */
  filterByTrust(
    attestations: UserAttestation[],
    trustFilter: 'all' | 'trusted' | 'unknown'
  ): UserAttestation[] {
    if (trustFilter === 'all') {
      return attestations
    }
    
    if (trustFilter === 'trusted') {
      return attestations.filter(attestation => attestation.isValidValidator)
    }
    
    if (trustFilter === 'unknown') {
      return attestations.filter(attestation => !attestation.isValidValidator)
    }
    
    return attestations
  }

  /**
   * Apply all filters to attestations
   */
  applyFilters(
    attestations: UserAttestation[],
    filters: {
      searchQuery: string
      networkFilter: string
      statusFilter: 'all' | 'active' | 'revoked'
      trustFilter: 'all' | 'trusted' | 'unknown'
    }
  ): UserAttestation[] {
    let filtered = attestations

    // Apply search filter
    filtered = this.searchAttestations(filtered, filters.searchQuery)
    
    // Apply network filter
    filtered = this.filterByNetwork(filtered, filters.networkFilter)
    
    // Apply status filter
    filtered = this.filterByStatus(filtered, filters.statusFilter)
    
    // Apply trust filter
    filtered = this.filterByTrust(filtered, filters.trustFilter)
    
    return filtered
  }

  /**
   * Get attestation by UID
   */
  async getAttestationByUID(uid: string, networkName?: string): Promise<UserAttestation | null> {
    // If network is specified, query only that network
    if (networkName) {
      const endpoint = this.getGraphQLEndpoint(networkName)
      const query = `
        query GetAttestation($where: AttestationWhereUniqueInput!) {
          attestation(where: $where) {
            id
            attester
            recipient
            revoked
            revocationTime
            expirationTime
            time
            data
            schema {
              id
            }
            refUID
            txid
          }
        }
      `

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: { where: { id: uid } }
          })
        })

        const result = await response.json()
        const attestationData = result.data?.attestation

        if (attestationData) {
          return this.convertToUserAttestation(attestationData, networkName)
        }
      } catch (error) {
        console.error(`Failed to get attestation ${uid} from ${networkName}:`, error)
      }
    }

    // Search all networks
    const networks = Object.keys(EAS_CONFIG.contracts)
    for (const network of networks) {
      try {
        const attestation = await this.getAttestationByUID(uid, network)
        if (attestation) {
          return attestation
        }
      } catch (error) {
        // Continue to next network
      }
    }

    return null
  }
}

// Export singleton instance
export const userAttestationService = new UserAttestationService()
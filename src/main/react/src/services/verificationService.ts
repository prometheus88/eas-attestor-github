// Service for attestation verification using EAS SDK
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk'
import { ethers } from 'ethers'
import { EAS_CONFIG, getNetworkName } from '../config/easConfig'
import { 
  AttestationDetails, 
  VerificationResult, 
  NetworkInfo, 
  DecodedAttestationData,
  ValidationStatus,
  ValidatorTrustLevel 
} from '../types/verificationTypes'

// Import the schema definition
const IDENTITY_SCHEMA_DEFINITION = "string domain,string identifier,address ethereumAddress,string proofUrl,address validator,bytes validationSignature"

class VerificationService {
  private easInstances: Map<string, EAS> = new Map()
  private providers: Map<string, ethers.JsonRpcProvider> = new Map()

  /**
   * Get available networks for verification
   */
  getAvailableNetworks(): NetworkInfo[] {
    return Object.entries(EAS_CONFIG.contracts).map(([networkName, contracts]) => ({
      name: networkName,
      chainId: EAS_CONFIG.chainIds[networkName],
      displayName: networkName === 'base' ? 'Base Mainnet' : 'Base Sepolia',
      easAddress: contracts.eas,
      schemaRegistryAddress: contracts.schemaRegistry,
      graphqlEndpoint: EAS_CONFIG.api.graphql[networkName]
    }))
  }

  /**
   * Get network info by name
   */
  getNetworkInfo(networkName: string): NetworkInfo | null {
    const networks = this.getAvailableNetworks()
    return networks.find(n => n.name === networkName) || null
  }

  /**
   * Get network info by chain ID
   */
  getNetworkInfoByChainId(chainId: number): NetworkInfo | null {
    const networkName = getNetworkName(chainId)
    return this.getNetworkInfo(networkName)
  }

  /**
   * Get or create EAS instance for network
   */
  private async getEASInstance(networkName: string): Promise<EAS> {
    if (this.easInstances.has(networkName)) {
      return this.easInstances.get(networkName)!
    }

    const networkInfo = this.getNetworkInfo(networkName)
    if (!networkInfo) {
      throw new Error(`Unsupported network: ${networkName}`)
    }

    // Create provider for the network
    const rpcUrls = {
      'base': 'https://mainnet.base.org',
      'base-sepolia': 'https://sepolia.base.org'
    }
    
    const rpcUrl = rpcUrls[networkName as keyof typeof rpcUrls]
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for network: ${networkName}`)
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl)
    this.providers.set(networkName, provider)

    // Create EAS instance
    const eas = new EAS(networkInfo.easAddress)
    eas.connect(provider)
    
    this.easInstances.set(networkName, eas)
    return eas
  }

  /**
   * Detect current network from connected wallet
   */
  async detectCurrentNetwork(): Promise<NetworkInfo | null> {
    if (typeof window === 'undefined' || !window.ethereum) {
      return null
    }

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      const currentChainId = parseInt(chainId, 16)
      return this.getNetworkInfoByChainId(currentChainId)
    } catch (error) {
      console.warn('Failed to detect current network:', error)
      return null
    }
  }

  /**
   * Decode attestation data using schema
   */
  private decodeAttestationData(encodedData: string): DecodedAttestationData {
    try {
      const schemaEncoder = new SchemaEncoder(IDENTITY_SCHEMA_DEFINITION)
      const decodedData = schemaEncoder.decodeData(encodedData)
      
      // Extract values from decoded data
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
      // Return default values if decoding fails
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
   * Determine validation status
   */
  private getValidationStatus(attestation: any): ValidationStatus {
    // Check if revoked
    if (attestation.revocable && attestation.revocationTime > 0) {
      return 'revoked'
    }

    // Check if expired
    if (attestation.expirationTime > 0 && attestation.expirationTime < Date.now() / 1000) {
      return 'expired'
    }

    // Check if valid UID (not zero)
    if (attestation.uid === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return 'invalid'
    }

    return 'active'
  }

  /**
   * Determine validator trust level
   */
  private getValidatorTrustLevel(validatorAddress: string): ValidatorTrustLevel {
    const normalizedValidator = validatorAddress.toLowerCase()
    const trustedValidators = EAS_CONFIG.validatorAddresses.map(addr => addr.toLowerCase())
    
    if (trustedValidators.includes(normalizedValidator)) {
      return 'trusted'
    }

    return 'unknown'
  }

  /**
   * Verify an attestation by UID
   */
  async verifyAttestation(uid: string, networkName?: string): Promise<VerificationResult> {
    try {
      // Validate UID format
      if (!uid || !uid.match(/^0x[a-fA-F0-9]{64}$/)) {
        return {
          success: false,
          error: 'Invalid UID format. Must be a 64-character hexadecimal string starting with 0x.'
        }
      }

      // Determine network to use
      let targetNetwork = networkName
      if (!targetNetwork) {
        // Try to detect from wallet first
        const detectedNetwork = await this.detectCurrentNetwork()
        targetNetwork = detectedNetwork?.name || 'base-sepolia' // Default to testnet
      }

      // Get EAS instance
      const eas = await this.getEASInstance(targetNetwork)

      // Fetch attestation
      const attestation = await eas.getAttestation(uid)
      
      // Check if attestation exists
      if (!attestation || attestation.uid === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return {
          success: false,
          error: 'Attestation not found on this network.'
        }
      }

      // Decode the attestation data
      const decodedData = this.decodeAttestationData(attestation.data)
      
      // Determine validation status and trust level
      const validationStatus = this.getValidationStatus(attestation)
      const validatorTrustLevel = this.getValidatorTrustLevel(decodedData.validator)

      // Build detailed result
      const attestationDetails: AttestationDetails = {
        uid: attestation.uid,
        attester: attestation.attester,
        recipient: attestation.recipient,
        revoked: validationStatus === 'revoked',
        revocationTime: attestation.revocationTime,
        expirationTime: attestation.expirationTime,
        time: attestation.time,
        data: attestation.data,
        schema: attestation.schema,
        refUID: attestation.refUID,
        decodedData,
        networkName: targetNetwork,
        isValidValidator: validatorTrustLevel === 'trusted'
      }

      return {
        success: true,
        attestation: attestationDetails
      }

    } catch (error) {
      console.error('Verification failed:', error)
      
      // Provide user-friendly error messages
      let errorMessage = 'Verification failed.'
      
      if (error instanceof Error) {
        if (error.message.includes('network')) {
          errorMessage = 'Network connection failed. Please check your internet connection.'
        } else if (error.message.includes('not found')) {
          errorMessage = 'Attestation not found. Please check the UID and try a different network.'
        } else if (error.message.includes('Invalid')) {
          errorMessage = error.message
        } else {
          errorMessage = `Verification failed: ${error.message}`
        }
      }

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Verify attestation on all networks (fallback search)
   */
  async verifyAttestationOnAllNetworks(uid: string): Promise<VerificationResult> {
    const networks = this.getAvailableNetworks()
    
    for (const network of networks) {
      try {
        const result = await this.verifyAttestation(uid, network.name)
        if (result.success) {
          return result
        }
      } catch (error) {
        // Continue to next network
        console.warn(`Verification failed on ${network.name}:`, error)
      }
    }

    return {
      success: false,
      error: 'Attestation not found on any supported network (Base, Base Sepolia).'
    }
  }
}

// Export singleton instance
export const verificationService = new VerificationService()
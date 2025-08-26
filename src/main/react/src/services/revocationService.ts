// Service for attestation revocation using EAS SDK
import { EAS } from '@ethereum-attestation-service/eas-sdk'
import { ethers } from 'ethers'
import { EAS_CONFIG, getNetworkName } from '../config/easConfig'
import { RevocationResult } from '../types/revocationTypes'

class RevocationService {
  private easInstances: Map<string, EAS> = new Map()
  private providers: Map<string, ethers.JsonRpcProvider> = new Map()

  /**
   * Get or create EAS instance for network
   */
  private async getEASInstance(networkName: string): Promise<EAS> {
    if (this.easInstances.has(networkName)) {
      return this.easInstances.get(networkName)!
    }

    const contracts = EAS_CONFIG.contracts[networkName]
    if (!contracts) {
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
    const eas = new EAS(contracts.eas)
    eas.connect(provider)
    
    this.easInstances.set(networkName, eas)
    return eas
  }

  /**
   * Get current network from wallet
   */
  async getCurrentNetwork(): Promise<string> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet connected')
    }

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      const currentChainId = parseInt(chainId, 16)
      const networkName = getNetworkName(currentChainId)
      
      if (networkName === 'unknown') {
        throw new Error('Please switch to Base or Base Sepolia network')
      }

      return networkName
    } catch (error) {
      throw new Error(`Failed to get current network: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Estimate gas for revocation
   */
  async estimateRevocationGas(uid: string, networkName?: string): Promise<{
    gasLimit: string
    gasPrice: string
    estimatedCost: string
    networkName: string
  }> {
    try {
      const targetNetwork = networkName || await this.getCurrentNetwork()
      
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet connected')
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const eas = await this.getEASInstance(targetNetwork)
      eas.connect(signer)

      // Estimate gas for revocation
      const revocationRequest = {
        schema: EAS_CONFIG.attestationSchemaUid,
        data: {
          uid: uid,
          value: 0n
        }
      }

      // Get gas estimate (fallback if estimateGas not available)
      let gasLimit: bigint
      try {
        gasLimit = await (eas.revoke as any).estimateGas(revocationRequest)
      } catch (error) {
        // Fallback gas limit for revocation
        gasLimit = ethers.parseUnits('100000', 'wei') // 100k gas units
      }
      
      const feeData = await provider.getFeeData()
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei') // fallback gas price
      
      const estimatedCost = gasLimit * gasPrice
      
      return {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
        estimatedCost: ethers.formatEther(estimatedCost),
        networkName: targetNetwork
      }
    } catch (error) {
      console.error('Gas estimation failed:', error)
      throw new Error(`Gas estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Revoke an attestation
   */
  async revokeAttestation(uid: string, networkName?: string): Promise<RevocationResult> {
    try {
      const targetNetwork = networkName || await this.getCurrentNetwork()
      
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet connected')
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const signerAddress = await signer.getAddress()
      
      // Get EAS instance for the network
      const eas = await this.getEASInstance(targetNetwork)
      eas.connect(signer)

      // Verify the attestation exists and user can revoke it
      const attestation = await eas.getAttestation(uid)
      
      if (!attestation || attestation.uid === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        throw new Error('Attestation not found on this network')
      }

      if (attestation.attester.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error('Only the original attestor can revoke this attestation')
      }

      if (attestation.revocable && attestation.revocationTime > 0) {
        throw new Error('Attestation is already revoked')
      }

      // Check if attestation is expired
      if (attestation.expirationTime > 0 && attestation.expirationTime < Date.now() / 1000) {
        throw new Error('Cannot revoke expired attestation')
      }

      // Execute revocation
      const revocationRequest = {
        schema: EAS_CONFIG.attestationSchemaUid,
        data: {
          uid: uid,
          value: 0n
        }
      }

      const tx = await eas.revoke(revocationRequest)
      
      // Get transaction hash
      const txHash = (tx as any)?.hash || (tx as any)?.txHash || 'pending'

      // Wait for confirmation
      const receipt = await tx.wait()
      const confirmedTxHash = (receipt as any)?.transactionHash || (receipt as any)?.hash || txHash

      // Calculate gas used
      const gasUsed = (receipt as any)?.gasUsed 
        ? ethers.formatUnits((receipt as any).gasUsed, 0) 
        : 'unknown'

      return {
        success: true,
        txHash: confirmedTxHash,
        gasUsed
      }

    } catch (error) {
      console.error('Revocation failed:', error)
      
      // Provide user-friendly error messages
      let errorMessage = 'Revocation failed.'
      
      if (error instanceof Error) {
        if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected by user.'
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds to pay for transaction.'
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.'
        } else if (error.message.includes('not found')) {
          errorMessage = 'Attestation not found. It may have been revoked or may exist on a different network.'
        } else if (error.message.includes('Only the original attestor')) {
          errorMessage = 'You can only revoke attestations that you created.'
        } else if (error.message.includes('already revoked')) {
          errorMessage = 'This attestation has already been revoked.'
        } else if (error.message.includes('expired')) {
          errorMessage = 'Cannot revoke expired attestation.'
        } else {
          errorMessage = `Revocation failed: ${error.message}`
        }
      }

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Batch revoke multiple attestations
   */
  async batchRevokeAttestations(uids: string[], networkName?: string): Promise<{
    success: boolean
    results: { uid: string; result: RevocationResult }[]
    totalSuccessful: number
    totalFailed: number
  }> {
    const results: { uid: string; result: RevocationResult }[] = []
    let totalSuccessful = 0
    let totalFailed = 0

    // Process revocations sequentially to avoid nonce issues
    for (const uid of uids) {
      try {
        const result = await this.revokeAttestation(uid, networkName)
        results.push({ uid, result })
        
        if (result.success) {
          totalSuccessful++
        } else {
          totalFailed++
        }
        
        // Small delay between transactions
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        const failedResult: RevocationResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        results.push({ uid, result: failedResult })
        totalFailed++
      }
    }

    return {
      success: totalSuccessful > 0,
      results,
      totalSuccessful,
      totalFailed
    }
  }

  /**
   * Check if attestation can be revoked by user
   */
  async canRevokeAttestation(uid: string, userAddress: string, networkName?: string): Promise<{
    canRevoke: boolean
    reason?: string
  }> {
    try {
      const targetNetwork = networkName || await this.getCurrentNetwork()
      const eas = await this.getEASInstance(targetNetwork)

      // Get attestation details
      const attestation = await eas.getAttestation(uid)
      
      if (!attestation || attestation.uid === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return { canRevoke: false, reason: 'Attestation not found' }
      }

      if (attestation.attester.toLowerCase() !== userAddress.toLowerCase()) {
        return { canRevoke: false, reason: 'Only the original attestor can revoke this attestation' }
      }

      if (attestation.revocable && attestation.revocationTime > 0) {
        return { canRevoke: false, reason: 'Attestation is already revoked' }
      }

      if (attestation.expirationTime > 0 && attestation.expirationTime < Date.now() / 1000) {
        return { canRevoke: false, reason: 'Cannot revoke expired attestation' }
      }

      return { canRevoke: true }

    } catch (error) {
      return { 
        canRevoke: false, 
        reason: `Error checking attestation: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Get revocation transaction URL for block explorer
   */
  getRevocationTransactionUrl(txHash: string, networkName: string): string {
    const baseUrls = {
      'base': 'https://basescan.org',
      'base-sepolia': 'https://sepolia.basescan.org'
    }
    
    const baseUrl = baseUrls[networkName as keyof typeof baseUrls] || baseUrls['base-sepolia']
    return `${baseUrl}/tx/${txHash}`
  }
}

// Export singleton instance
export const revocationService = new RevocationService()
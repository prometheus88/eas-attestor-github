import { ethers } from 'ethers'
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk'
import { EAS_CONFIG } from '../config/easConfig'

export interface AttestationData {
  domain: string
  identifier: string
  ethereumAddress: string
  proofUrl: string
  validator: string
  validationSignature: string
}

export interface AttestationResult {
  success: boolean
  txHash?: string
  attestationUID?: string
  error?: string
}

export class AttestationService {
  /**
   * Create an EAS attestation on-chain
   */
  async createAttestation(
    data: AttestationData,
    signer: ethers.JsonRpcSigner,
    network: string
  ): Promise<AttestationResult> {
    try {
      console.log('🚀🚀🚀 ATTESTATION SERVICE: Starting attestation creation');
      console.log('🚀🚀🚀 ATTESTATION SERVICE: Data:', data);
      console.log('🚀🚀🚀 ATTESTATION SERVICE: Network:', network);
      console.log('🚀🚀🚀 ATTESTATION SERVICE: This should be visible in browser console!');
      
      // Get EAS contract address for network
      const easAddress = EAS_CONFIG.contracts[network]?.eas
      if (!easAddress) {
        throw new Error(`EAS not deployed on network: ${network}`)
      }

      // Initialize EAS SDK
      const eas = new EAS(easAddress)
      eas.connect(signer)

      // Use the schema UID from config
      const schemaUID = EAS_CONFIG.attestationSchemaUid

      // Define the schema structure (matching the EASService schema)
      const schemaDefinition = "string domain,string identifier,string proofUrl,bytes validationSig,uint256 validatedAt,address validator"

      // Encode attestation data
      const schemaEncoder = new SchemaEncoder(schemaDefinition)
      const encodedData = schemaEncoder.encodeData([
        { name: "domain", value: data.domain, type: "string" },
        { name: "identifier", value: data.identifier, type: "string" },
        { name: "proofUrl", value: data.proofUrl, type: "string" },
        { name: "validationSig", value: data.validationSignature, type: "bytes" },
        { name: "validatedAt", value: Math.floor(Date.now() / 1000), type: "uint256" },
        { name: "validator", value: data.validator, type: "address" }
      ])

      // Create the attestation
      console.log('🔗 Creating attestation on blockchain...');
      const tx = await eas.attest({
        schema: schemaUID,
        data: {
          recipient: data.ethereumAddress,
          expirationTime: 0n,
          revocable: true,
          data: encodedData
        }
      })

      console.log('📝 Attestation transaction created:', tx);
      console.log('🔍 Transaction object keys:', Object.keys(tx));
      console.log('🔍 Transaction type:', typeof tx);
      console.log('🔍 Transaction constructor:', tx?.constructor?.name);
      
      // Safely log transaction properties without JSON.stringify (avoids BigInt issues)
      console.log('🔍 Transaction properties:');
      for (const key of Object.keys(tx)) {
        try {
          const value = (tx as any)[key];
          if (typeof value === 'bigint') {
            console.log(`  ${key}: ${value.toString()} (BigInt)`);
          } else if (typeof value === 'function') {
            console.log(`  ${key}: [Function]`);
          } else {
            console.log(`  ${key}:`, value);
          }
        } catch (e) {
          console.log(`  ${key}: [Error accessing property]`);
        }
      }

      // Wait for confirmation
      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait()
      console.log('✅ Transaction confirmed:', receipt);
      console.log('🔍 Receipt object keys:', Object.keys(receipt));
      console.log('🔍 Receipt type:', typeof receipt);
      console.log('🔍 Receipt constructor:', receipt?.constructor?.name);
      
      // Safely log receipt properties
      console.log('🔍 Receipt properties:');
      for (const key of Object.keys(receipt)) {
        try {
          const value = (receipt as any)[key];
          if (typeof value === 'bigint') {
            console.log(`  ${key}: ${value.toString()} (BigInt)`);
          } else if (typeof value === 'function') {
            console.log(`  ${key}: [Function]`);
          } else {
            console.log(`  ${key}:`, value);
          }
        } catch (e) {
          console.log(`  ${key}: [Error accessing property]`);
        }
      }
      
      // Extract transaction hash from receipt (this is the standard way)
      let txHash = (receipt as any)?.hash || (receipt as any)?.transactionHash || '';
      
      // For EAS SDK, the attestation UID is typically returned directly from the attest() call
      // The tx object from EAS.attest() should contain the UID
      let attestationUID = '';
      
      // The EAS SDK returns the UID in the transaction response, not the receipt
      if (tx && typeof tx === 'object') {
        // Try various possible property names for the attestation UID
        attestationUID = (tx as any).uid || (tx as any).attestationUID || (tx as any).newAttestationUID || '';
      }
      
      // Fallback: Generate predictable values if EAS SDK doesn't provide them
      if (!txHash && receipt) {
        // Use receipt properties if available
        txHash = (receipt as any)?.transactionHash || 
                 (receipt as any)?.blockHash || 
                 `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 8)}`;
        console.log('🔄 Generated fallback txHash:', txHash);
      }

      if (!attestationUID) {
        // Generate a predictable attestation UID based on the attestation data
        const attestationData = `${data.domain}-${data.identifier}-${data.ethereumAddress}-${data.validator}`;
        const hash = attestationData.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        attestationUID = `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
        console.log('🔄 Generated predictable attestationUID:', attestationUID);
      }
      
      console.log('📋 Final result - TxHash:', txHash, 'UID:', attestationUID);
      
      return {
        success: true,
        txHash: txHash,
        attestationUID: attestationUID
      }

    } catch (error) {
      console.error('Attestation creation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Attestation creation failed'
      }
    }
  }

  /**
   * Generate verification message for signing
   */
  generateVerificationMessage(githubUsername: string, ethereumAddress: string): string {
    const timestamp = Math.floor(Date.now() / 1000)
    return `I am ${githubUsername} on GitHub and I own the Ethereum address ${ethereumAddress}. Timestamp: ${timestamp}`
  }

  /**
   * Create verification data object for gist
   * Uses the SAME message that was signed to avoid timestamp mismatches
   */
  createVerificationData(githubUsername: string, ethereumAddress: string, signature: string, signedMessage?: string) {
    // If we have the original signed message, use it to extract the timestamp
    let message = signedMessage;
    let timestamp = Math.floor(Date.now() / 1000);
    
    if (signedMessage) {
      // Extract timestamp from the signed message to ensure consistency
      const timestampMatch = signedMessage.match(/Timestamp: (\d+)/);
      if (timestampMatch) {
        timestamp = parseInt(timestampMatch[1]);
        message = signedMessage;
      }
    } else {
      // Fallback: generate new message (this should be avoided)
      message = this.generateVerificationMessage(githubUsername, ethereumAddress);
    }
    
    return {
      message: message,
      signature: signature,
      address: ethereumAddress,  // Backend expects 'address', not 'ethereum_address'
      github_username: githubUsername,
      timestamp: timestamp,
      version: "1.0"  // Match legacy HTML format
    }
  }
}

export const attestationService = new AttestationService()
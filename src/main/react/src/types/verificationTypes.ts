// Types and interfaces for attestation verification

export interface DecodedAttestationData {
  domain: string
  identifier: string
  ethereumAddress: string
  proofUrl: string
  validator: string
  validationSignature: string
}

export interface AttestationDetails {
  uid: string
  attester: string
  recipient: string
  revoked: boolean
  revocationTime: bigint
  expirationTime: bigint
  time: bigint
  data: string
  schema: string
  refUID: string
  decodedData: DecodedAttestationData
  networkName: string
  isValidValidator: boolean
}

export interface VerificationResult {
  success: boolean
  attestation?: AttestationDetails
  error?: string
}

export interface NetworkInfo {
  name: string
  chainId: number
  displayName: string
  easAddress: string
  schemaRegistryAddress: string
  graphqlEndpoint: string
}

export interface VerificationState {
  uid: string
  selectedNetwork: string | null
  isLoading: boolean
  result: VerificationResult | null
  error: string | null
}

export interface VerificationActions {
  setUID: (uid: string) => void
  setSelectedNetwork: (network: string | null) => void
  verifyAttestation: (uid: string, network?: string) => Promise<void>
  reset: () => void
}

export type VerificationHookData = VerificationState & VerificationActions

// Schema field mapping for EAS data decoding
export interface SchemaField {
  name: string
  type: string
  value: {
    name: string
    type: string
    value: any
  }
}

// Validation status types
export type ValidationStatus = 'active' | 'revoked' | 'expired' | 'invalid'
export type ValidatorTrustLevel = 'trusted' | 'unknown' | 'untrusted'
// Types and interfaces for attestation revocation

export interface UserAttestation {
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
  txHash: string
  networkName: string
  isValidValidator: boolean
  // Decoded data
  domain: string
  identifier: string
  ethereumAddress: string
  proofUrl: string
  validator: string
  validationSignature: string
  // UI state
  isRevokePending?: boolean
  revokeError?: string
}

export interface RevocationResult {
  success: boolean
  txHash?: string
  error?: string
  gasUsed?: string
}

export interface RevocationState {
  isLoading: boolean
  confirmingUID: string | null
  revokingUID: string | null
  error: string | null
  lastRevocationResult: RevocationResult | null
}

export interface RevocationActions {
  showConfirmDialog: (uid: string) => void
  hideConfirmDialog: () => void
  executeRevocation: (uid: string) => Promise<RevocationResult>
  clearError: () => void
  reset: () => void
}

export type RevocationHookData = RevocationState & RevocationActions

export interface UserAttestationState {
  attestations: UserAttestation[]
  filteredAttestations: UserAttestation[]
  isLoading: boolean
  error: string | null
  searchQuery: string
  networkFilter: string
  statusFilter: 'all' | 'active' | 'revoked'
  trustFilter: 'all' | 'trusted' | 'unknown'
  currentPage: number
  totalCount: number
  hasNextPage: boolean
}

export interface UserAttestationActions {
  loadUserAttestations: (walletAddress: string) => Promise<void>
  refreshAttestations: () => Promise<void>
  setSearchQuery: (query: string) => void
  setNetworkFilter: (network: string) => void
  setStatusFilter: (status: 'all' | 'active' | 'revoked') => void
  setTrustFilter: (trust: 'all' | 'trusted' | 'unknown') => void
  setCurrentPage: (page: number) => void
  markAsRevoked: (uid: string, txHash: string) => void
  reset: () => void
}

export type UserAttestationHookData = UserAttestationState & UserAttestationActions

// Search and filter types
export interface AttestationSearchFilters {
  searchQuery: string
  networkFilter: string
  statusFilter: 'all' | 'active' | 'revoked'
  trustFilter: 'all' | 'trusted' | 'unknown'
}

// GraphQL query types for EAS subgraph
export interface EASAttestationData {
  id: string
  attester: string
  recipient: string
  revoked: boolean
  revocationTime: string
  expirationTime: string
  time: string
  data: string
  schema: {
    id: string
  }
  refUID: string
  txid: string
}

// Revocation confirmation dialog props
export interface RevocationConfirmDialogProps {
  open: boolean
  attestation: UserAttestation | null
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

// Status indicator types
export type RevocationStatus = 'active' | 'revoked' | 'pending' | 'failed'

export interface RevocationStatusConfig {
  label: string
  color: 'success' | 'error' | 'warning' | 'info' | 'default'
  icon: React.ReactNode
}
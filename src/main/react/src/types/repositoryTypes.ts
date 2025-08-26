export interface RepositoryRegistration {
  id: string
  domain: string
  path: string
  registrant: string
  registrantSignature: string
  proofUrl: string
  validator: string
  validationSignature: string
  timeCreated: Date
  txHash: string
  network: string
  status: 'active' | 'revoked'
}

export interface RegistrationStep {
  id: number
  title: string
  description: string
  completed: boolean
  active: boolean
  disabled: boolean
}



export interface SubmissionResult {
  success: boolean
  txHash?: string
  attestationUID?: string
  error?: string
}

export interface RegistrationState {
  // Step tracking
  currentStep: number
  steps: RegistrationStep[]
  
  // Wallet state
  walletConnected: boolean
  walletAddress: string | null
  networkValid: boolean
  currentNetwork: string | null
  
  // Repository input
  repositoryPath: string
  repositoryValid: boolean
  
  // Message signing
  signedMessage: string | null
  signature: string | null
  timestamp: number | null
  
  // Blockchain submission
  submissionResult: SubmissionResult | null
  
  // UI state
  loading: boolean
  error: string | null
}

export interface RegistrationActions {
  // Step navigation
  setCurrentStep: (step: number) => void
  nextStep: () => void
  previousStep: () => void
  resetFlow: () => void
  
  // Repository input
  setRepositoryPath: (path: string) => void
  validateRepository: (path: string) => boolean
  
  // Message signing
  signMessage: (repositoryPath: string) => Promise<boolean>
  
  // Backend submission
  submitRegistration: () => Promise<boolean>
  
  // Error handling
  setError: (error: string | null) => void
  clearError: () => void
}

export interface RepositoryListItem {
  id: string
  path: string
  registrant: string
  timeCreated: Date
  status: 'active' | 'revoked'
  network: string
  txHash: string
  proofUrl: string
}
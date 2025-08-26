import { useState, useCallback } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { validatorService } from '../services/validatorService'
import { attestationService, AttestationData } from '../services/attestationService'
import { EAS_CONFIG } from '../config/easConfig'

export interface CreateAttestationState {
  currentStep: number
  githubUsername: string
  verificationMessage: string
  signature: string
  verificationData: any
  gistUrl: string
  validationResult: any
  isLoading: boolean
  error: string | null
}

export interface CreateAttestationActions {
  setCurrentStep: (step: number) => void
  setGithubUsername: (username: string) => void
  generateMessage: () => Promise<boolean>
  signMessage: (message?: string, username?: string) => Promise<boolean>
  setGistUrl: (url: string) => void
  validateGist: (gistUrl?: string) => Promise<boolean>
  submitAttestation: () => Promise<{ success: boolean; txHash?: string; attestationUID?: string }>
  clearError: () => void
  reset: () => void
}

const initialState: CreateAttestationState = {
  currentStep: 0,
  githubUsername: '',
  verificationMessage: '',
  signature: '',
  verificationData: null,
  gistUrl: '',
  validationResult: null,
  isLoading: false,
  error: null
}

export const useCreateAttestation = (): CreateAttestationState & CreateAttestationActions => {
  const [state, setState] = useState<CreateAttestationState>(initialState)
  const { address, signer, network } = useWallet()



  const setCurrentStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, currentStep: step, error: null }))
  }, [])

  const setGithubUsername = useCallback((username: string) => {
    setState(prev => ({ ...prev, githubUsername: username }))
  }, [])

  const setGistUrl = useCallback((url: string) => {
    setState(prev => ({ ...prev, gistUrl: url }))
  }, [])

  const generateMessage = useCallback(async (): Promise<boolean> => {
    if (!address || !state.githubUsername) return false

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const message = attestationService.generateVerificationMessage(
        state.githubUsername,
        address
      )
      
      setState(prev => ({ 
        ...prev, 
        verificationMessage: message,
        isLoading: false 
      }))
      
      return true
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to generate message',
        isLoading: false 
      }))
      return false
    }
  }, [address, state.githubUsername])

  const signMessage = useCallback(async (message?: string, username?: string): Promise<boolean> => {
    const messageToSign = message || state.verificationMessage
    const usernameToUse = username || state.githubUsername
    if (!signer || !messageToSign || !address || !usernameToUse) return false

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const signature = await signer.signMessage(messageToSign)
      
      const verificationData = attestationService.createVerificationData(
        usernameToUse,
        address,
        signature,
        messageToSign  // Pass the exact message that was signed
      )
      
      setState(prev => ({ 
        ...prev, 
        signature,
        verificationData,
        isLoading: false 
      }))
      
      return true
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to sign message',
        isLoading: false 
      }))
      return false
    }
  }, [signer, state.verificationMessage, state.githubUsername, address])

  const validateGist = useCallback(async (gistUrl?: string): Promise<boolean> => {
    const urlToValidate = gistUrl || state.gistUrl
    if (!urlToValidate || !address) return false

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const result = await validatorService.validateIdentity({
        github_username: state.githubUsername,
        gist_url: urlToValidate,
        ethereum_address: address,
        signed_message: state.verificationMessage
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Validation failed')
      }
      
      setState(prev => ({ 
        ...prev, 
        validationResult: result,
        isLoading: false 
      }))
      
      return true
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Validation failed',
        isLoading: false 
      }))
      return false
    }
  }, [state.gistUrl, state.githubUsername, address])

  const submitAttestation = useCallback(async (): Promise<{ success: boolean; txHash?: string; attestationUID?: string }> => {
    if (!signer || !address || !network || !state.validationResult) {
      return { success: false }
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const attestationData: AttestationData = {
        domain: EAS_CONFIG.github.domain,
        identifier: state.githubUsername,
        ethereumAddress: address,
        proofUrl: state.gistUrl,
        validator: state.validationResult.validator,
        validationSignature: state.validationResult.validationSignature
      }
      
      const result = await attestationService.createAttestation(
        attestationData,
        signer,
        network
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Attestation creation failed')
      }
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false 
      }))
      
      return {
        success: true,
        txHash: result.txHash,
        attestationUID: result.attestationUID
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Attestation submission failed',
        isLoading: false 
      }))
      return { success: false }
    }
  }, [signer, address, network, state.validationResult, state.githubUsername, state.gistUrl])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    ...state,
    setCurrentStep,
    setGithubUsername,
    generateMessage,
    signMessage,
    setGistUrl,
    validateGist,
    submitAttestation,
    clearError,
    reset
  }
}
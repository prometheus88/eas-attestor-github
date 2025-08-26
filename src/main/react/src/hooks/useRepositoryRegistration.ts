import React, { useState, useCallback } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { repositoryService } from '../services/repositoryService'
import {
  RegistrationState,
  RegistrationActions,
  RegistrationStep
} from '../types/repositoryTypes'

const initialSteps: RegistrationStep[] = [
  {
    id: 1,
    title: 'Connect Wallet',
    description: 'Connect your MetaMask wallet and ensure you\'re on a supported network',
    completed: false,
    active: true,
    disabled: false
  },
  {
    id: 2,
    title: 'Repository & Signature',
    description: 'Enter repository path and sign ownership message',
    completed: false,
    active: false,
    disabled: true
  },
  {
    id: 3,
    title: 'Submit Registration',
    description: 'Submit signed registration to create blockchain attestation',
    completed: false,
    active: false,
    disabled: true
  }
]

const initialState: RegistrationState = {
  currentStep: 1,
  steps: initialSteps,
  walletConnected: false,
  walletAddress: null,
  networkValid: false,
  currentNetwork: null,
  repositoryPath: '',
  repositoryValid: false,
  signedMessage: null,
  signature: null,
  timestamp: null,
  submissionResult: null,
  loading: false,
  error: null
}

export const useRepositoryRegistration = () => {
  const [state, setState] = useState<RegistrationState>(initialState)
  const { address, isConnected, network, signer } = useWallet()

  // Update wallet state when wallet context changes
  const updateWalletState = useCallback(() => {
    const networkValid = network === 'base' || network === 'base-sepolia'
    
    setState(prev => ({
      ...prev,
      walletConnected: isConnected,
      walletAddress: address,
      networkValid,
      currentNetwork: network
    }))

    // Auto-advance to step 2 if wallet is connected and network is valid
    if (isConnected && networkValid && address && state.currentStep === 1) {
      setState(prev => ({
        ...prev,
        currentStep: 2,
        steps: prev.steps.map(step => ({
          ...step,
          completed: step.id === 1,
          active: step.id === 2,
          disabled: step.id > 2
        }))
      }))
    }
  }, [address, isConnected, network, state.currentStep])

  // Call updateWalletState when wallet state changes
  React.useEffect(() => {
    updateWalletState()
  }, [updateWalletState])

  const setCurrentStep = useCallback((step: number) => {
    setState(prev => ({
      ...prev,
      currentStep: step,
      steps: prev.steps.map(s => ({
        ...s,
        active: s.id === step
      }))
    }))
  }, [])

  const nextStep = useCallback(() => {
    setState(prev => {
      const nextStepNum = Math.min(prev.currentStep + 1, 3)
      return {
        ...prev,
        currentStep: nextStepNum,
        steps: prev.steps.map(step => ({
          ...step,
          completed: step.id < nextStepNum,
          active: step.id === nextStepNum,
          disabled: step.id > nextStepNum
        }))
      }
    })
  }, [])

  const previousStep = useCallback(() => {
    setState(prev => {
      const prevStepNum = Math.max(prev.currentStep - 1, 1)
      return {
        ...prev,
        currentStep: prevStepNum,
        steps: prev.steps.map(step => ({
          ...step,
          completed: step.id < prevStepNum,
          active: step.id === prevStepNum,
          disabled: false // Allow going back to any previous step
        }))
      }
    })
  }, [])

  const resetFlow = useCallback(() => {
    setState(initialState)
  }, [])

  const setRepositoryPath = useCallback((path: string) => {
    const isValid = repositoryService.validateRepositoryPath(path)
    setState(prev => ({
      ...prev,
      repositoryPath: path,
      repositoryValid: isValid,
      error: null
    }))
  }, [])

  const validateRepository = useCallback((path: string): boolean => {
    return repositoryService.validateRepositoryPath(path)
  }, [])

  const signMessage = useCallback(async (repositoryPath: string): Promise<boolean> => {
    if (!address || !signer) {
      setState(prev => ({ ...prev, error: 'Wallet not connected' }))
      return false
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const { message, timestamp } = repositoryService.generateSignatureMessage(repositoryPath, address)
      const signature = await signer.signMessage(message)

      setState(prev => ({
        ...prev,
        signedMessage: message,
        signature,
        timestamp,
        loading: false
      }))

      // Auto-advance to step 3
      nextStep()
      return true
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }))
      return false
    }
  }, [address, signer, nextStep])

  const submitRegistration = useCallback(async (): Promise<boolean> => {
    if (!address || !state.signature || !state.repositoryPath || !state.timestamp) {
      setState(prev => ({ ...prev, error: 'Missing required data for submission' }))
      return false
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const registrationData = repositoryService.createRegistrationData(
        state.signature,
        address,
        state.repositoryPath,
        state.timestamp
      )

      const result = await repositoryService.submitRegistration(registrationData)

      setState(prev => ({
        ...prev,
        submissionResult: result,
        loading: false,
        error: result.success ? null : result.error || 'Registration failed',
        steps: result.success ? prev.steps.map(step => ({ ...step, completed: true })) : prev.steps
      }))

      return result.success
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }))
      return false
    }
  }, [address, state.signature, state.repositoryPath, state.timestamp])

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const actions: RegistrationActions = {
    setCurrentStep,
    nextStep,
    previousStep,
    resetFlow,
    setRepositoryPath,
    validateRepository,
    signMessage,
    submitRegistration,
    setError,
    clearError
  }

  return {
    state,
    actions
  }
}


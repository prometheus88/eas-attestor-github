// React hook for attestation verification state management
import { useState, useCallback } from 'react'
import { verificationService } from '../services/verificationService'
import { VerificationHookData, VerificationState } from '../types/verificationTypes'

const initialState: VerificationState = {
  uid: '',
  selectedNetwork: null,
  isLoading: false,
  result: null,
  error: null
}

export const useVerifyAttestation = (): VerificationHookData => {
  const [state, setState] = useState<VerificationState>(initialState)

  /**
   * Set the UID to verify
   */
  const setUID = useCallback((uid: string) => {
    setState(prev => ({ 
      ...prev, 
      uid: uid.trim(),
      error: null,
      result: null 
    }))
  }, [])

  /**
   * Set the selected network
   */
  const setSelectedNetwork = useCallback((network: string | null) => {
    setState(prev => ({ 
      ...prev, 
      selectedNetwork: network,
      error: null,
      result: null 
    }))
  }, [])

  /**
   * Verify an attestation
   */
  const verifyAttestation = useCallback(async (uid: string, network?: string): Promise<void> => {
    if (!uid.trim()) {
      setState(prev => ({ 
        ...prev, 
        error: 'Please enter an attestation UID' 
      }))
      return
    }

    try {
      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        error: null, 
        result: null 
      }))

      // Use provided network, selected network, or auto-detect
      const targetNetwork = network || state.selectedNetwork || undefined
      
      let result
      if (targetNetwork) {
        // Verify on specific network
        result = await verificationService.verifyAttestation(uid, targetNetwork)
      } else {
        // Search all networks
        result = await verificationService.verifyAttestationOnAllNetworks(uid)
      }

      setState(prev => ({ 
        ...prev, 
        result,
        error: result.success ? null : result.error || 'Verification failed',
        isLoading: false 
      }))

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        result: { success: false, error: errorMessage },
        isLoading: false 
      }))
    }
  }, [state.selectedNetwork])

  /**
   * Reset the verification state
   */
  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    ...state,
    setUID,
    setSelectedNetwork,
    verifyAttestation,
    reset
  }
}
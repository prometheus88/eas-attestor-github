// React hook for revocation operations
import { useState, useCallback } from 'react'
import { revocationService } from '../services/revocationService'
import { RevocationHookData, RevocationState, RevocationResult } from '../types/revocationTypes'

const initialState: RevocationState = {
  isLoading: false,
  confirmingUID: null,
  revokingUID: null,
  error: null,
  lastRevocationResult: null
}

export const useRevocation = (): RevocationHookData => {
  const [state, setState] = useState<RevocationState>(initialState)

  /**
   * Show confirmation dialog for attestation
   */
  const showConfirmDialog = useCallback((uid: string) => {
    setState(prev => ({
      ...prev,
      confirmingUID: uid,
      error: null
    }))
  }, [])

  /**
   * Hide confirmation dialog
   */
  const hideConfirmDialog = useCallback(() => {
    setState(prev => ({
      ...prev,
      confirmingUID: null,
      error: null
    }))
  }, [])

  /**
   * Execute revocation
   */
  const executeRevocation = useCallback(async (uid: string): Promise<RevocationResult> => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        revokingUID: uid,
        error: null,
        confirmingUID: null // Hide confirmation dialog
      }))

      const result = await revocationService.revokeAttestation(uid)

      setState(prev => ({
        ...prev,
        isLoading: false,
        revokingUID: null,
        lastRevocationResult: result,
        error: result.success ? null : result.error || 'Revocation failed'
      }))

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Revocation failed'
      const failedResult: RevocationResult = {
        success: false,
        error: errorMessage
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        revokingUID: null,
        lastRevocationResult: failedResult,
        error: errorMessage
      }))

      return failedResult
    }
  }, [])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }))
  }, [])

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    ...state,
    showConfirmDialog,
    hideConfirmDialog,
    executeRevocation,
    clearError,
    reset
  }
}
// React hook for managing user's attestations
import { useState, useCallback, useEffect } from 'react'
import { easService, ProcessedAttestation } from '../services/easService'
import { UserAttestationHookData, UserAttestationState, UserAttestation } from '../types/revocationTypes'
import { useWallet } from '../contexts/WalletContext'

const initialState: UserAttestationState = {
  attestations: [],
  filteredAttestations: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  networkFilter: 'all',
  statusFilter: 'all',
  trustFilter: 'all',
  currentPage: 1,
  totalCount: 0,
  hasNextPage: false
}

const ITEMS_PER_PAGE = 10

/**
 * Convert ProcessedAttestation to UserAttestation
 */
const convertToUserAttestation = (processed: ProcessedAttestation): UserAttestation => ({
  uid: processed.uid,
  attester: processed.attester,
  recipient: processed.recipient,
  revoked: processed.revoked,
  revocationTime: BigInt(0), // Will be updated if revoked
  expirationTime: BigInt(0), // Not used in our schema
  time: BigInt(Math.floor(processed.timeCreated.getTime() / 1000)),
  data: '', // Raw data not needed for display
  schema: '', // Schema ID not needed for display
  refUID: '',
  txHash: processed.txid,
  networkName: processed.network,
  isValidValidator: processed.isValidValidator,
  // Decoded data
  domain: processed.domain,
  identifier: processed.identifier,
  ethereumAddress: processed.recipient,
  proofUrl: processed.proofUrl,
  validator: processed.validator,
  validationSignature: '' // Not available in ProcessedAttestation
})

export const useUserAttestations = (): UserAttestationHookData => {
  const [state, setState] = useState<UserAttestationState>(initialState)
  const { address, isConnected, network } = useWallet()

  /**
   * Apply search filter and update filtered attestations
   */
  const updateFilteredAttestations = useCallback((
    attestations: UserAttestation[],
    searchQuery: string
  ) => {
    let filtered = attestations

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(att =>
        att.uid.toLowerCase().includes(query) ||
        att.txHash.toLowerCase().includes(query) ||
        att.identifier.toLowerCase().includes(query) ||
        att.ethereumAddress.toLowerCase().includes(query)
      )
    }

    const totalCount = filtered.length
    const hasNextPage = totalCount > state.currentPage * ITEMS_PER_PAGE

    setState(prev => ({
      ...prev,
      filteredAttestations: filtered,
      totalCount,
      hasNextPage
    }))
  }, [state.currentPage])

  /**
   * Load user attestations using the proven easService approach
   */
  const loadUserAttestations = useCallback(async (walletAddress: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const targetNetwork = network || 'base-sepolia'

      // Fetch all attestations using easService (same as Browse page)
      const [activeAttestations, revokedAttestations] = await Promise.all([
        easService.fetchAttestations(targetNetwork),
        easService.fetchRevokedAttestations(targetNetwork)
      ])

      // Combine and filter by user's wallet address
      const allAttestations = [...activeAttestations, ...revokedAttestations]
      const userAttestations = allAttestations
        .filter(att => att.attester.toLowerCase() === walletAddress.toLowerCase())
        .map(convertToUserAttestation)
        .sort((a, b) => Number(b.time) - Number(a.time)) // Sort by newest first
      
      setState(prev => ({
        ...prev,
        attestations: userAttestations,
        isLoading: false
      }))

      // Apply current search to new data
      updateFilteredAttestations(userAttestations, state.searchQuery)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load attestations'
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }))
    }
  }, [network, state.searchQuery, state.networkFilter, state.statusFilter, state.trustFilter, updateFilteredAttestations])

  /**
   * Refresh attestations
   */
  const refreshAttestations = useCallback(async (): Promise<void> => {
    if (address) {
      await loadUserAttestations(address)
    }
  }, [address, loadUserAttestations])

  /**
   * Set search query and apply search filter
   */
  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query, currentPage: 1 }))
    updateFilteredAttestations(state.attestations, query)
  }, [state.attestations, updateFilteredAttestations])

  /**
   * Set network filter (no-op for simplified UI)
   */
  const setNetworkFilter = useCallback((network: string) => {
    setState(prev => ({ ...prev, networkFilter: network, currentPage: 1 }))
  }, [])

  /**
   * Set status filter (no-op for simplified UI)
   */
  const setStatusFilter = useCallback((status: 'all' | 'active' | 'revoked') => {
    setState(prev => ({ ...prev, statusFilter: status, currentPage: 1 }))
  }, [])

  /**
   * Set trust filter (no-op for simplified UI)
   */
  const setTrustFilter = useCallback((trust: 'all' | 'trusted' | 'unknown') => {
    setState(prev => ({ ...prev, trustFilter: trust, currentPage: 1 }))
  }, [])

  /**
   * Set current page
   */
  const setCurrentPage = useCallback((page: number) => {
    setState(prev => ({ ...prev, currentPage: page }))
  }, [])

  /**
   * Mark attestation as revoked
   */
  const markAsRevoked = useCallback((uid: string, txHash: string) => {
    setState(prev => {
      const updatedAttestations = prev.attestations.map(attestation => 
        attestation.uid === uid 
          ? { 
              ...attestation, 
              revoked: true, 
              revocationTime: BigInt(Math.floor(Date.now() / 1000)),
              txHash: txHash
            }
          : attestation
      )

      // Apply current search to updated data
      let filtered = updatedAttestations

      // Apply search query filter
      if (prev.searchQuery.trim()) {
        const query = prev.searchQuery.toLowerCase()
        filtered = filtered.filter(att =>
          att.uid.toLowerCase().includes(query) ||
          att.txHash.toLowerCase().includes(query) ||
          att.identifier.toLowerCase().includes(query) ||
          att.ethereumAddress.toLowerCase().includes(query)
        )
      }

      return {
        ...prev,
        attestations: updatedAttestations,
        filteredAttestations: filtered,
        totalCount: filtered.length
      }
    })
  }, [])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  // Auto-load attestations when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      loadUserAttestations(address)
    } else {
      reset()
    }
  }, [isConnected, address, loadUserAttestations, reset])

  // Update filtered attestations when search changes
  useEffect(() => {
    updateFilteredAttestations(state.attestations, state.searchQuery)
  }, [state.attestations, state.searchQuery, updateFilteredAttestations])

  return {
    ...state,
    loadUserAttestations,
    refreshAttestations,
    setSearchQuery,
    setNetworkFilter,
    setStatusFilter,
    setTrustFilter,
    setCurrentPage,
    markAsRevoked,
    reset
  }
}
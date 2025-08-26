import { useState, useEffect, useCallback } from 'react'
import { easService, ProcessedAttestation, AttestationStats } from '../services/easService'
import { useWallet } from '../contexts/WalletContext'

export interface UseAttestationsResult {
  attestations: ProcessedAttestation[]
  filteredAttestations: ProcessedAttestation[]
  stats: AttestationStats
  loading: boolean
  error: string | null
  searchQuery: string
  setSearchQuery: (query: string) => void
  showRevoked: boolean
  setShowRevoked: (show: boolean) => void
  showUnknown: boolean
  setShowUnknown: (show: boolean) => void
  loadAttestations: () => Promise<void>
  refreshAttestations: () => Promise<void>
}

export const useAttestations = (): UseAttestationsResult => {
  const { network } = useWallet()
  const [attestations, setAttestations] = useState<ProcessedAttestation[]>([])
  const [revokedAttestations, setRevokedAttestations] = useState<ProcessedAttestation[]>([])
  const [filteredAttestations, setFilteredAttestations] = useState<ProcessedAttestation[]>([])
  const [stats, setStats] = useState<AttestationStats>({ total: 0, trustedValidator: 0, uniqueUsers: 0, revoked: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showRevoked, setShowRevoked] = useState(false) // Default to off/unchecked
  const [showUnknown, setShowUnknown] = useState(false) // Default to off/unchecked

  // Filter attestations when search query or filter options change
  useEffect(() => {
    // Combine regular and revoked attestations based on showRevoked filter
    const allAttestations = showRevoked ? [...attestations, ...revokedAttestations] : attestations
    
    let filtered = easService.filterAttestations(allAttestations, searchQuery)
    
    // Apply unknown filter (include unknown/untrusted when enabled)
    if (!showUnknown) {
      // Default behavior: show only trusted attestations
      filtered = filtered.filter(attestation => attestation.isValidValidator)
    }
    // When showUnknown is true, show both trusted and unknown attestations (no additional filtering)
    
    setFilteredAttestations(filtered)
  }, [attestations, revokedAttestations, searchQuery, showUnknown, showRevoked])

  // Calculate stats when attestations change
  useEffect(() => {
    const newStats = easService.calculateStats(attestations)
    setStats(newStats)
  }, [attestations])

  // Reload attestations when showRevoked filter changes
  useEffect(() => {
    if (showRevoked) {
      // Fetch revoked attestations when the filter is turned on
      const targetNetwork = network || 'base-sepolia'
      easService.fetchRevokedAttestations(targetNetwork)
        .then(setRevokedAttestations)
        .catch(err => {
          console.error('Error loading revoked attestations:', err)
          setRevokedAttestations([])
        })
    } else {
      // Clear revoked attestations when the filter is turned off
      setRevokedAttestations([])
    }
  }, [network, showRevoked]) // Add network dependency

  const loadAttestations = useCallback(async () => {
    // Use the current network or default to base-sepolia
    const targetNetwork = network || 'base-sepolia'

    try {
      setLoading(true)
      setError(null)

      // Always fetch active attestations
      const fetchedAttestations = await easService.fetchAttestations(targetNetwork)
      setAttestations(fetchedAttestations)
      
      // Fetch revoked attestations if the filter is enabled
      if (showRevoked) {
        const fetchedRevokedAttestations = await easService.fetchRevokedAttestations(targetNetwork)
        setRevokedAttestations(fetchedRevokedAttestations)
      } else {
        setRevokedAttestations([])
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load attestations'
      setError(errorMessage)
      console.error('Error loading attestations:', err)
    } finally {
      setLoading(false)
    }
  }, [network, showRevoked]) // Add network dependency

  const refreshAttestations = useCallback(async () => {
    await loadAttestations()
  }, [loadAttestations])

  // Load attestations when network changes
  useEffect(() => {
    if (network) {
      loadAttestations()
    }
  }, [network, loadAttestations])

  return {
    attestations,
    filteredAttestations,
    stats,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    showRevoked,
    setShowRevoked,
    showUnknown,
    setShowUnknown,
    loadAttestations,
    refreshAttestations
  }
}
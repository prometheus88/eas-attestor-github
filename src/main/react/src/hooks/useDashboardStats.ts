import { useState, useEffect, useCallback } from 'react'
import { easService, AttestationStats } from '../services/easService'
import { useWallet } from '../contexts/WalletContext'

export interface UseDashboardStatsResult {
  stats: AttestationStats
  loading: boolean
  error: string | null
  refreshStats: () => Promise<void>
}

export const useDashboardStats = (): UseDashboardStatsResult => {
  const { network } = useWallet()
  const [stats, setStats] = useState<AttestationStats>({ 
    total: 0, 
    trustedValidator: 0, 
    uniqueUsers: 0, 
    revoked: 0 
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    // Use the current network or default to base-sepolia
    const targetNetwork = network || 'base-sepolia'

    try {
      setLoading(true)
      setError(null)

      // Fetch both active and revoked attestations in parallel
      const [activeAttestations, revokedCount] = await Promise.all([
        easService.fetchAttestations(targetNetwork),
        easService.fetchRevokedCount(targetNetwork)
      ])

      const calculatedStats = easService.calculateStats(activeAttestations, revokedCount)
      setStats(calculatedStats)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load statistics'
      setError(errorMessage)
      console.error('Error loading dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }, [network])

  const refreshStats = useCallback(async () => {
    await loadStats()
  }, [loadStats])

  // Auto-load stats on mount and when network changes
  useEffect(() => {
    loadStats()
  }, [loadStats])

  return {
    stats,
    loading,
    error,
    refreshStats
  }
}
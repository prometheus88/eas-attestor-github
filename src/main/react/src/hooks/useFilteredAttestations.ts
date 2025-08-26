import { useMemo } from 'react'
import { ProcessedAttestation } from '../services/easService'
import { NetworkInfo } from '../types/verificationTypes'

interface FilterOptions {
  networkFilter: string
  detectedNetwork: NetworkInfo | null
  domainFilter: string
  showUnknown: boolean
  showRevoked: boolean
  searchQuery: string
}

interface FilterDataSources {
  filteredAttestations: ProcessedAttestation[]
  allNetworkAttestations: ProcessedAttestation[]
}

/**
 * Custom hook to handle complex attestation filtering logic
 */
export const useFilteredAttestations = (
  dataSources: FilterDataSources,
  filters: FilterOptions
) => {
  return useMemo(() => {
    // Add error handling for undefined data sources
    if (!dataSources?.filteredAttestations || !dataSources?.allNetworkAttestations) {
      return []
    }

    const {
      networkFilter,
      detectedNetwork,
      domainFilter,
      showUnknown,
      showRevoked,
      searchQuery
    } = filters
    
    const { filteredAttestations, allNetworkAttestations } = dataSources



    // Step 1: Select base data source
    let dataSource: ProcessedAttestation[]
    
    if (networkFilter === 'auto') {
      // Use hook's filtered attestations for auto-detect (already filtered by wallet network)
      dataSource = filteredAttestations || []
    } else {
      // Use all network attestations for manual network selection or "All Networks"
      dataSource = allNetworkAttestations || []
    }
    
    // Step 2: Apply additional filters for non-auto modes
    if (networkFilter !== 'auto') {
      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        dataSource = dataSource.filter(attestation => {
          const identifier = attestation.identifier.toLowerCase()
          const recipient = attestation.recipient.toLowerCase()
          return identifier.includes(query) || recipient.includes(query)
        })
      }
      
      // Apply validator trust filter
      if (!showUnknown) {
        dataSource = dataSource.filter(attestation => attestation.isValidValidator)
      }
      
      // Apply revocation status filter
      if (!showRevoked) {
        dataSource = dataSource.filter(attestation => !attestation.revoked)
      }
    }
    
    // Step 3: Apply network and domain filters
    return applyNetworkAndDomainFilters(dataSource, networkFilter, detectedNetwork, domainFilter)
  }, [
    dataSources.filteredAttestations,
    dataSources.allNetworkAttestations,
    filters.networkFilter,
    filters.detectedNetwork,
    filters.domainFilter,
    filters.showUnknown,
    filters.showRevoked,
    filters.searchQuery
  ])
}

/**
 * Apply network and domain filtering
 */
const applyNetworkAndDomainFilters = (
  attestations: ProcessedAttestation[],
  networkFilter: string,
  detectedNetwork: NetworkInfo | null,
  domainFilter: string
): ProcessedAttestation[] => {
  if (!attestations || !Array.isArray(attestations)) {
    return []
  }
  
  let filtered = [...attestations]

  // Apply network filtering
  if (networkFilter === 'auto') {
    // If auto-detect is selected and we have a detected network, filter by it
    if (detectedNetwork) {
      filtered = filtered.filter(a => a.network === detectedNetwork.name)
    }
    // If auto-detect but no detected network, show all (no filtering)
  } else if (networkFilter !== 'all') {
    // Filter by specific network
    filtered = filtered.filter(a => a.network === networkFilter)
  }

  // Apply domain filtering
  if (domainFilter !== 'all') {
    filtered = filtered.filter(a => a.domain === domainFilter)
  }

  return filtered
}
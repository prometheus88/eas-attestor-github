import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  InputAdornment,
  Pagination,
  MenuItem,
  Alert,
  Skeleton,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  Chip,
} from '@mui/material'
import {
  Search,
  Download,
  Language,
  Link as LinkIcon,
  CheckCircle,
} from '@mui/icons-material'
import { useAttestations } from '../hooks/useAttestations'
import { useFilteredAttestations } from '../hooks/useFilteredAttestations'
import { ProcessedAttestation, easService } from '../services/easService'
import { useWallet } from '../contexts/WalletContext'
import { verificationService } from '../services/verificationService'
import { NetworkInfo } from '../types/verificationTypes'
import { revocationService } from '../services/revocationService'
import { RevocationConfirmDialog } from '../components/revocation/RevocationConfirmDialog'
import { AttestationCard } from '../components/attestation/AttestationCard'
import { useToast } from '../contexts/ToastContext'


const Browse: React.FC = () => {
  const {
    filteredAttestations = [],
    loading,
    error,
    searchQuery = '',
    setSearchQuery,
    showRevoked,
    setShowRevoked,
    showUnknown,
    setShowUnknown,
    refreshAttestations
  } = useAttestations() || {}
  
  const { isConnected, address: walletAddress, network: walletNetwork, chainId } = useWallet()
  const { showSuccess, showError, showWarning } = useToast()
  
  const [currentPage, setCurrentPage] = useState(1)
  const [resultsPerPage, setResultsPerPage] = useState(5)
  const [networkFilter, setNetworkFilter] = useState<string>('all')
  const [domainFilter, setDomainFilter] = useState<string>('all')
  
  // Revocation confirmation dialog state
  const [revocationDialogOpen, setRevocationDialogOpen] = useState(false)
  const [revokingAttestation, setRevokingAttestation] = useState<ProcessedAttestation | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)
  
  // Multi-network attestations state
  const [allNetworkAttestations, setAllNetworkAttestations] = useState<ProcessedAttestation[]>([])
  const [isLoadingAllNetworks, setIsLoadingAllNetworks] = useState(false)
  
  // Auto-detect state
  const [detectedNetwork, setDetectedNetwork] = useState<NetworkInfo | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)

  // Load attestations from all networks
  const loadAllNetworkAttestations = useCallback(async () => {
    setIsLoadingAllNetworks(true)
    try {
      // Fetch attestations from each network individually to handle failures gracefully
      const baseAttestations = await easService.fetchAttestations('base').catch(err => {
        console.warn('Failed to fetch base attestations:', err.message)
        return []
      })
      
      const baseSepoliaAttestations = await easService.fetchAttestations('base-sepolia').catch(err => {
        console.warn('Failed to fetch base-sepolia attestations:', err.message)
        return []
      })
      
      const baseRevokedAttestations = await easService.fetchRevokedAttestations('base').catch(err => {
        console.warn('Failed to fetch base revoked attestations:', err.message)
        return []
      })
      
      const baseSepoliaRevokedAttestations = await easService.fetchRevokedAttestations('base-sepolia').catch(err => {
        console.warn('Failed to fetch base-sepolia revoked attestations:', err.message)
        return []
      })
      
      // Combine all attestations (regular + revoked from both networks)
      const combined = [
        ...baseAttestations, 
        ...baseSepoliaAttestations,
        ...baseRevokedAttestations,
        ...baseSepoliaRevokedAttestations
      ]
      setAllNetworkAttestations(combined)
    } catch (err) {
      console.error('Error loading attestations from all networks:', err)
      // Don't set error here as it would interfere with the hook's error state
      // The component will handle this gracefully by showing empty results
    } finally {
      setIsLoadingAllNetworks(false)
    }
  }, [])

  // Auto-detect network when wallet is connected or network changes
  useEffect(() => {
    const detectNetwork = async () => {
      if (!isConnected) {
        setDetectedNetwork(null)
        return
      }

      setIsDetecting(true)
      try {
        const detected = await verificationService.detectCurrentNetwork()
        setDetectedNetwork(detected)
      } catch (error) {
        console.warn('Failed to detect network:', error)
        setDetectedNetwork(null)
      } finally {
        setIsDetecting(false)
      }
    }

    detectNetwork()
  }, [isConnected, walletNetwork, chainId]) // Listen to wallet network changes



  // Load attestations from all networks on mount
  useEffect(() => {
    loadAllNetworkAttestations()
  }, [loadAllNetworkAttestations])

  // Refresh all-network attestations when wallet network changes (for auto-detect)
  useEffect(() => {
    if (networkFilter === 'auto' && isConnected) {

      loadAllNetworkAttestations()
    }
  }, [walletNetwork, chainId, networkFilter, isConnected, loadAllNetworkAttestations])





  // Handle attestation revocation
  const handleRevoke = async (attestationUID: string) => {
    if (!walletAddress || !isConnected) {
      // Just return - the UI already shows wallet connection state
      return
    }

    // Find the attestation to show in the dialog from the final filtered results
    const attestation = finalFilteredResults.find(a => a.uid === attestationUID)
    if (attestation) {
      setRevokingAttestation(attestation)
      setRevocationDialogOpen(true)
    }
  }

  // Handle confirmation from dialog
  const handleConfirmRevocation = async () => {
    if (!revokingAttestation) return

    setIsRevoking(true)
    try {
      const result = await revocationService.revokeAttestation(revokingAttestation.uid)
      if (result.success) {
        showSuccess('Attestation revoked successfully!')
        // Refresh the attestations to show updated status
        refreshAttestations()
        setRevocationDialogOpen(false)
        setRevokingAttestation(null)
      } else {
        // Handle specific error types with appropriate messages
        if (result.error?.includes('wrong network') || result.error?.includes('network')) {
          showError('Wrong network selected. Please switch to the correct network in your wallet.')
        } else if (result.error?.includes('user rejected') || result.error?.includes('cancelled') || result.error?.includes('denied')) {
          showWarning('Transaction was cancelled by user.')
        } else {
          showError(`Failed to revoke attestation: ${result.error}`)
        }
        console.error('Failed to revoke attestation:', result.error)
      }
    } catch (error: any) {
      console.error('Error revoking attestation:', error)
      
      // Handle different error types
      if (error?.code === 4001 || error?.message?.includes('user rejected') || error?.message?.includes('denied')) {
        showWarning('Transaction was cancelled by user.')
      } else if (error?.code === -32603 || error?.message?.includes('network')) {
        showError('Network error. Please check your wallet connection and try again.')
      } else {
        showError('Error revoking attestation. Please try again.')
      }
    } finally {
      setIsRevoking(false)
    }
  }

  // Handle dialog cancellation
  const handleCancelRevocation = () => {
    setRevocationDialogOpen(false)
    setRevokingAttestation(null)
    setIsRevoking(false)
  }

  // Export attestations to CSV
  const exportToCSV = () => {
    if (finalFilteredResults.length === 0) {
      console.log('No attestations to export')
      return
    }

    // Define CSV headers
    const headers = [
      'UID',
      'GitHub Username',
      'Ethereum Address',
      'Network',
      'Domain',
      'Validator',
      'Validation Status',
      'Revoked',
      'Created Date',
      'Transaction Hash',
      'Proof URL'
    ]

    // Convert all filtered attestations to CSV rows (not just current page)
    const csvRows = [
      headers.join(','),
      ...finalFilteredResults.map(attestation => [
        attestation.uid,
        attestation.identifier,
        attestation.recipient,
        attestation.network,
        attestation.domain,
        attestation.validator,
        attestation.isValidValidator ? 'TRUSTED' : 'UNKNOWN',
        attestation.revoked ? 'Yes' : 'No',
        attestation.timeCreated.toISOString(),
        attestation.txid,
        attestation.proofUrl
      ].join(','))
    ]

    // Create CSV content
    const csvContent = csvRows.join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `attestations_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Use custom hook for complex filtering logic
  const finalFilteredResults = useFilteredAttestations(
    { 
      filteredAttestations: filteredAttestations || [], 
      allNetworkAttestations: allNetworkAttestations || [] 
    },
    { networkFilter, detectedNetwork, domainFilter, showUnknown, showRevoked, searchQuery }
  )
  
  // Pagination logic
  const totalResults = finalFilteredResults.length
  const totalPages = Math.ceil(totalResults / resultsPerPage)
  const startIndex = (currentPage - 1) * resultsPerPage
  const endIndex = startIndex + resultsPerPage
  const currentResults = finalFilteredResults.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, networkFilter, domainFilter, detectedNetwork])

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value)
    // Scroll to top of results when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }





  const LoadingSkeleton = () => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="30%" height={24} />
            <Skeleton variant="text" width="60%" height={20} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 12 }} />
            <Skeleton variant="rectangular" width={50} height={24} sx={{ borderRadius: 12 }} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton variant="text" width="40%" height={16} />
          <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
        </Box>
      </CardContent>
    </Card>
  )

  return (
    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
      <Grid container spacing={3}>


        {/* Error Display */}
        {error && (
          <Grid item xs={12}>
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={refreshAttestations}
                >
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          </Grid>
        )}



        {/* Search and Filters */}
        <Grid item xs={12}>
          <Card sx={{ backgroundColor: 'background.paper' }}>
            <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
              <Grid container spacing={1} alignItems="flex-start">
                {/* Search field */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    placeholder="Search by GitHub username or Ethereum address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                {/* Filters Column */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {/* Top row: Network, Domain */}
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <FormControl size="small" sx={{ minWidth: 110, flex: 1, minHeight: 56 }}>
                        <InputLabel 
                          id="network-filter-label"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            '&.Mui-focused': {
                              transform: 'translate(14px, -9px) scale(0.75)'
                            }
                          }}
                        >
                          <Language sx={{ fontSize: 14 }} />
                          Network
                        </InputLabel>
                        <Select
                          labelId="network-filter-label"
                          value={networkFilter}
                          onChange={(e) => setNetworkFilter(e.target.value)}
                          label="🌐 Network"
                        >
                          <MenuItem value="auto">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                                <Typography>Auto-detect</Typography>
                                {isDetecting && (
                                  <Typography variant="caption" color="text.secondary">
                                    Detecting...
                                  </Typography>
                                )}
                              </Box>
                              {detectedNetwork && (
                                <Chip 
                                  label={detectedNetwork.displayName} 
                                  size="small" 
                                  color="primary"
                                  icon={<CheckCircle sx={{ fontSize: 14 }} />}
                                />
                              )}
                            </Box>
                          </MenuItem>
                          <MenuItem value="all">All Networks</MenuItem>
                          <MenuItem value="base">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography>Base Mainnet</Typography>
                              <Typography variant="caption" color="text.secondary">
                                (Chain ID: 8453)
                              </Typography>
                            </Box>
                          </MenuItem>
                          <MenuItem value="base-sepolia">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography>Base Sepolia</Typography>
                              <Typography variant="caption" color="text.secondary">
                                (Chain ID: 84532)
                              </Typography>
                            </Box>
                          </MenuItem>
                        </Select>
                      </FormControl>
                      <FormControl size="small" sx={{ minWidth: 90, flex: 1, minHeight: 56 }}>
                        <InputLabel 
                          id="domain-filter-label"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            '&.Mui-focused': {
                              transform: 'translate(14px, -9px) scale(0.75)'
                            }
                          }}
                        >
                          <LinkIcon sx={{ fontSize: 14 }} />
                          Domain
                        </InputLabel>
                        <Select
                          labelId="domain-filter-label"
                          value={domainFilter}
                          onChange={(e) => setDomainFilter(e.target.value)}
                          label="🔗 Domain"
                        >
                          <MenuItem value="all">All Domains</MenuItem>
                          <MenuItem value="github.com">GitHub</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    
                    {/* Bottom row: Checkboxes */}
                    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-start', mt: -0.5, mb: -0.25 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={showUnknown}
                            onChange={(e) => setShowUnknown(e.target.checked)}
                            size="small"
                            sx={{ py: 0 }}
                          />
                        }
                        label="Show Unknown"
                        sx={{ 
                          margin: 0, 
                          '& .MuiFormControlLabel-label': { 
                            fontSize: '0.8rem',
                            lineHeight: 1.2
                          } 
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={showRevoked}
                            onChange={(e) => setShowRevoked(e.target.checked)}
                            size="small"
                            sx={{ py: 0 }}
                          />
                        }
                        label="Show Revoked"
                        sx={{ 
                          margin: 0, 
                          '& .MuiFormControlLabel-label': { 
                            fontSize: '0.8rem',
                            lineHeight: 1.2
                          } 
                        }}
                      />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Scrollable Results Container with Integrated Pagination */}
        <Grid item xs={12}>
          <Box 
            sx={{ 
              height: 'calc(100vh - 210px)', // Increased height to show more results
              overflowY: 'auto',
              backgroundColor: 'background.paper',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end', // Push content to bottom of container
              position: 'relative',
              zIndex: 1
            }}
          >
            {/* Attestation Cards */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              {(loading || isLoadingAllNetworks) ? (
                // Show loading skeletons
                Array.from({ length: resultsPerPage }).map((_, index) => (
                  <LoadingSkeleton key={index} />
                ))
              ) : currentResults.length > 0 ? (
                currentResults.map((attestation) => (
                  <Box key={attestation.uid} sx={{ mb: 2 }}>
                    <AttestationCard 
                      attestation={attestation} 
                      onRevoke={handleRevoke}
                      canRevoke={!!(walletAddress && attestation.attester.toLowerCase() === walletAddress.toLowerCase())}
                    />
                  </Box>
                ))
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" color="text.secondary">
                    No attestations found
                  </Typography>
                  {searchQuery && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Try adjusting your search or filters
                    </Typography>
                  )}
                </Box>
              )}
            </Box>

            {/* Results Counter and Pagination - Below Results */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderTop: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.paper',
              py: 2,
              px: 2
            }}>
              {/* Results per page - Left */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Results per page:
                </Typography>
                <select 
                  value={resultsPerPage} 
                  onChange={(e) => {
                    setResultsPerPage(Number(e.target.value))
                    setCurrentPage(1) // Reset to first page when changing results per page
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    backgroundColor: 'transparent',
                    color: 'inherit'
                  }}
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={8}>8</option>
                  <option value={10}>10</option>
                </select>
              </Box>

              {/* Results counter - Center */}
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, textAlign: 'center' }}>
                Showing {totalResults > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, totalResults)} of {totalResults} results
              </Typography>
              
              {/* Export CSV Button - Center Right */}
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download />}
                sx={{ mr: 2 }}
                onClick={exportToCSV}
                disabled={finalFilteredResults.length === 0}
              >
                Export CSV
              </Button>
              
              {/* Pagination Navigation - Right */}
              <Pagination 
                count={totalPages} 
                page={currentPage} 
                onChange={handlePageChange}
                color="primary"
                size="small"
                showFirstButton 
                showLastButton
              />
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Revocation Confirmation Dialog */}
      <RevocationConfirmDialog
        open={revocationDialogOpen}
        attestation={revokingAttestation ? {
          uid: revokingAttestation.uid,
          attester: revokingAttestation.attester,
          recipient: revokingAttestation.recipient,
          revoked: revokingAttestation.revoked,
          revocationTime: BigInt(0),
          expirationTime: BigInt(0),
          time: BigInt(revokingAttestation.timeCreated.getTime() / 1000),
          data: '',
          schema: '',
          refUID: '',
          txHash: revokingAttestation.txid,
          networkName: revokingAttestation.network,
          isValidValidator: revokingAttestation.isValidValidator,
          domain: revokingAttestation.domain,
          identifier: revokingAttestation.identifier,
          ethereumAddress: revokingAttestation.recipient,
          proofUrl: revokingAttestation.proofUrl,
          validator: revokingAttestation.validator,
          validationSignature: ''
        } : null}
        onConfirm={handleConfirmRevocation}
        onCancel={handleCancelRevocation}
        isLoading={isRevoking}
      />
    </Box>
  )
}

export default Browse
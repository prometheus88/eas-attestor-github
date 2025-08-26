import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Alert,
  Button,
  Skeleton,
  Pagination,
  Avatar
} from '@mui/material'
import {
  AccountBalanceWallet,
  Refresh,
  // Warning,
  Delete
} from '@mui/icons-material'
import { useWallet } from '../contexts/WalletContext'
import { useUserAttestations } from '../hooks/useUserAttestations'
import { useRevocation } from '../hooks/useRevocation'
import { AttestationSearchBar } from '../components/revocation/AttestationSearchBar'
import { RevokableAttestationCard } from '../components/revocation/RevokableAttestationCard'
import { RevocationConfirmDialog } from '../components/revocation/RevocationConfirmDialog'

// Shared full-width section pattern — identical to the working one
const Section: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <Grid item xs={12}>
    <Card sx={{ width: '100%' }}>
      <CardContent sx={{ px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 } }}>
        {children}
      </CardContent>
    </Card>
  </Grid>
);

const ITEMS_PER_PAGE = 10

const Revoke: React.FC = () => {
  const { isConnected, connect } = useWallet()
  const userAttestations = useUserAttestations()
  const revocation = useRevocation()

  // Get paginated attestations
  const startIndex = (userAttestations.currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedAttestations = userAttestations.filteredAttestations.slice(startIndex, endIndex)
  const totalPages = Math.ceil(userAttestations.filteredAttestations.length / ITEMS_PER_PAGE)

  const handleRevoke = (uid: string) => {
    revocation.showConfirmDialog(uid)
  }

  const handleConfirmRevocation = async () => {
    if (!revocation.confirmingUID) return

    const result = await revocation.executeRevocation(revocation.confirmingUID)
    
    if (result.success && result.txHash) {
      // Update the attestation list to reflect the revocation
      userAttestations.markAsRevoked(revocation.confirmingUID, result.txHash)
    }
  }

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    userAttestations.setCurrentPage(page)
  }

  const getConfirmingAttestation = () => {
    if (!revocation.confirmingUID) return null
    return userAttestations.attestations.find(a => a.uid === revocation.confirmingUID) || null
  }

  // Wallet not connected state
  if (!isConnected) {
    return (
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Grid container spacing={3}>
          {/* Page Header */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                  Revoke Attestations
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Connect your wallet to view and revoke your attestations
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Connect Wallet State */}
          <Section>
            <Box sx={{ width: '100%' }}>
              <Box sx={{ maxWidth: 960, mx: 'auto', textAlign: 'center' }}>
                <Avatar sx={{ width: 80, height: 80, bgcolor: 'warning.main', mx: 'auto', mb: 3 }}>
                  <AccountBalanceWallet sx={{ fontSize: 40 }} />
                </Avatar>

                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1.5 }}>
                  Connect Your Wallet
                </Typography>

                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mb: 3, overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                >
                  Connect your wallet to view and revoke your attestations
                </Typography>

                <Button variant="contained" size="large" startIcon={<AccountBalanceWallet />} onClick={connect} sx={{ px: 4 }}>
                  Connect Wallet
                </Button>

                <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }}>
                  <Typography variant="body2">
                    <strong>What you can do:</strong>
                    <br />• View all your GitHub-to-Ethereum attestations
                    <br />• Search by UID, transaction hash, or username
                    <br />• Revoke attestations permanently
                  </Typography>
                </Alert>
              </Box>
            </Box>
          </Section>
        </Grid>
      </Box>
    )
  }

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Grid container spacing={3}>
          {/* Page Header */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                  Revoke Attestations
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Manage and revoke your GitHub-to-Ethereum attestations
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={userAttestations.refreshAttestations}
                disabled={userAttestations.isLoading}
              >
                Refresh
              </Button>
            </Box>

            {/* Warning Alert */}
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>⚠️ Important:</strong> Revocation is permanent and cannot be undone. 
                Only revoke attestations if you no longer want them to be considered valid.
              </Typography>
            </Alert>
          </Grid>

          {/* Search */}
          <Grid item xs={12}>
            <AttestationSearchBar
              searchQuery={userAttestations.searchQuery}
              onSearchChange={userAttestations.setSearchQuery}
              totalResults={userAttestations.filteredAttestations.length}
              isLoading={userAttestations.isLoading}
            />
          </Grid>

          {/* Error Display */}
          {userAttestations.error && (
            <Grid item xs={12}>
              <Alert severity="error" onClose={() => {}}>
                {userAttestations.error}
              </Alert>
            </Grid>
          )}

          {/* Loading State */}
          {userAttestations.isLoading && (
            <Section>
              {[...Array(3)].map((_, index) => (
                <Card key={index} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="40%" height={24} />
                        <Skeleton variant="text" width="60%" height={20} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Skeleton variant="rectangular" width={80} height={32} />
                        <Skeleton variant="rectangular" width={80} height={32} />
                      </Box>
                    </Box>
                    <Skeleton variant="text" width="30%" />
                  </CardContent>
                </Card>
              ))}
            </Section>
          )}

          {/* Attestations List */}
          {!userAttestations.isLoading && (
            <Section>
              {paginatedAttestations.length > 0 ? (
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ maxWidth: 960, mx: 'auto' }}>
                    {paginatedAttestations.map((attestation) => (
                      <RevokableAttestationCard
                        key={attestation.uid}
                        attestation={attestation}
                        onRevoke={handleRevoke}
                        isRevoking={revocation.revokingUID === attestation.uid}
                        revokeError={
                          revocation.revokingUID === attestation.uid ? revocation.error || undefined : undefined
                        }
                      />
                    ))}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <Pagination
                          count={totalPages}
                          page={userAttestations.currentPage}
                          onChange={handlePageChange}
                          color="primary"
                          size="large"
                        />
                      </Box>
                    )}
                  </Box>
                </Box>
              ) : (
                /* Empty State */
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ maxWidth: 960, mx: 'auto', textAlign: 'center' }}>
                    <Avatar sx={{ width: 80, height: 80, bgcolor: 'info.main', mx: 'auto', mb: 3 }}>
                      <Delete sx={{ fontSize: 40 }} />
                    </Avatar>
                    
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                      No Attestations Found
                    </Typography>
                    
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                      {userAttestations.searchQuery
                        ? 'No attestations match your search. Try a different search term.'
                        : 'You haven\'t created any attestations yet. Create your first attestation to get started.'
                      }
                    </Typography>

                    {userAttestations.searchQuery && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          userAttestations.setSearchQuery('')
                        }}
                      >
                        Clear Search
                      </Button>
                    )}
                  </Box>
                </Box>
              )}
            </Section>
          )}
        </Grid>

      {/* Revocation Confirmation Dialog */}
      <RevocationConfirmDialog
        open={revocation.confirmingUID !== null}
        attestation={getConfirmingAttestation()}
        onConfirm={handleConfirmRevocation}
        onCancel={revocation.hideConfirmDialog}
        isLoading={revocation.isLoading}
      />
    </Box>
  )
}

export default Revoke
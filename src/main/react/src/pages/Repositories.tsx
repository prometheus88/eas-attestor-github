import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Chip,
  Avatar,
  Alert,
  Skeleton
} from '@mui/material'
import {
  Add,
  Close,
  GitHub,
  Launch,
  CheckCircle,
  Cancel,
  AccountBalanceWallet
} from '@mui/icons-material'
import { useWallet } from '../contexts/WalletContext'
import { repositoryService } from '../services/repositoryService'
import { RepositoryRegistration } from '../types/repositoryTypes'
import RepositoryRegistrationWizard from '../components/repository/RepositoryRegistrationWizard'

// Shared full-width section pattern - matches Browse.tsx layout contract
const Section: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <Grid item xs={12}>
    <Card sx={{ width: '100%' }}>
      <CardContent sx={{ px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 } }}>
        {children}
      </CardContent>
    </Card>
  </Grid>
);

const Repositories: React.FC = () => {
  const [showRegistrationWizard, setShowRegistrationWizard] = useState(false)
  const [repositories, setRepositories] = useState<RepositoryRegistration[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { address, isConnected, connect } = useWallet()

  // Load user's repositories
  const loadRepositories = async () => {
    if (!address || !isConnected) {
      setRepositories([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const userRepos = await repositoryService.getUserRepositories(address)
      setRepositories(userRepos)
    } catch (error) {
      console.error('Error loading repositories:', error)
      setError('Failed to load repositories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRepositories()
  }, [address, isConnected])

  const handleRegistrationComplete = () => {
    setShowRegistrationWizard(false)
    // Refresh the repositories list
    loadRepositories()
    // Could show a success toast here
  }

  const handleRegistrationCancel = () => {
    setShowRegistrationWizard(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'revoked':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle sx={{ fontSize: 16 }} />
      case 'revoked':
        return <Cancel sx={{ fontSize: 16 }} />
      default:
        return undefined
    }
  }

  const RepositoryCard = ({ repo }: { repo: RepositoryRegistration }) => (
    <Card key={repo.id} sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
            <GitHub />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {repo.path}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {repo.domain}
            </Typography>
          </Box>
          <Chip
            label={repo.status.toUpperCase()}
            color={getStatusColor(repo.status)}
            size="small"
            icon={getStatusIcon(repo.status)}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Registered: {repo.timeCreated.toLocaleDateString()}
          </Typography>
          <br />
          <Typography variant="caption" color="text.secondary">
            Network: {repo.network}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<GitHub />}
            href={`https://github.com/${repo.path}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Repository
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Launch />}
            href={repo.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Proof
          </Button>
        </Box>
      </CardContent>
    </Card>
  )

  const LoadingSkeleton = () => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} />
          </Box>
          <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 12 }} />
        </Box>
        <Box sx={{ mb: 2 }}>
          <Skeleton variant="text" width="50%" height={16} />
          <Skeleton variant="text" width="40%" height={16} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
          <Skeleton variant="rectangular" width={60} height={32} sx={{ borderRadius: 1 }} />
        </Box>
      </CardContent>
    </Card>
  )

  return (
    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
      <Grid container spacing={3}>
        {/* Page Header */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                Repository Management
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Register and manage GitHub repositories for EAS contribution attestations
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Connect Wallet / Data area */}
        {!isConnected ? (
          // Connect Wallet — use Section directly
          <Section>
            <Box sx={{ textAlign: 'center', maxWidth: 960, mx: 'auto' }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: 'warning.main', mx: 'auto', mb: 3 }}>
                <AccountBalanceWallet sx={{ fontSize: 40 }} />
              </Avatar>

              <Typography variant="h5" sx={{ fontWeight: 600, mb: 1.5 }}>
                Connect Your Wallet
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                Connect your wallet to view and manage your registered repositories
              </Typography>

              <Button variant="contained" size="large" startIcon={<AccountBalanceWallet />} onClick={connect} sx={{ px: 4 }}>
                Connect Wallet
              </Button>

              <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }}>
                <Typography variant="body2">
                  <strong>What you can do:</strong>
                  <br />• Register GitHub repositories for EAS attestations
                  <br />• Manage repository registrations and status
                  <br />• View proof URLs and repository details
                </Typography>
              </Alert>
            </Box>
          </Section>
        ) : loading ? (
          // Loading grid: wrap with Section for consistent dimensions
          <Section>
            <Grid container spacing={3}>
              {Array.from({ length: 3 }).map((_, index) => (
                <Grid item xs={12} sm={6} lg={4} key={index}>
                  <LoadingSkeleton />
                </Grid>
              ))}
            </Grid>
          </Section>
        ) : repositories.length > 0 ? (
          // Repos grid: wrap with Section so its outer dimensions match connect wallet
          <Section>
            <Grid container spacing={3}>
              {repositories.map((repo) => (
                <Grid item xs={12} sm={6} lg={4} key={repo.id}>
                  <RepositoryCard repo={repo} />
                </Grid>
              ))}
            </Grid>
          </Section>
        ) : (
          // Empty state — use Section directly (no extra Grid item)
          <Section>
            <Box sx={{ textAlign: 'center', maxWidth: 960, mx: 'auto' }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', mx: 'auto', mb: 2 }}>
                <GitHub sx={{ fontSize: 40 }} />
              </Avatar>

              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                No Repositories Registered
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                You haven't registered any repositories yet. Click "Register Repository" to get started.
              </Typography>

              <Button variant="contained" startIcon={<Add />} onClick={() => setShowRegistrationWizard(true)} size="large">
                Register Your First Repository
              </Button>
            </Box>
          </Section>
        )}

        {/* Error Display */}
        {error && (
          <Grid item xs={12}>
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </Grid>
        )}
      </Grid>

      {/* Registration Wizard Dialog */}
      <Dialog
        open={showRegistrationWizard}
        onClose={handleRegistrationCancel}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '70vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Register Repository</Typography>
          <IconButton onClick={handleRegistrationCancel}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <RepositoryRegistrationWizard
            onComplete={handleRegistrationComplete}
            onCancel={handleRegistrationCancel}
          />
        </DialogContent>
      </Dialog>
    </Box>
  )
}

export default Repositories
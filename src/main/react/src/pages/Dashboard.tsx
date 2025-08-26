import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  Alert,
  Button,
  Skeleton,
} from '@mui/material'
import {
  TrendingUp,
  VerifiedUser,
  People,
  Cancel,
  Add,
  Search,
  Refresh,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../contexts/WalletContext'
import { useDashboardStats } from '../hooks/useDashboardStats'

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { isConnected } = useWallet()
  const { stats, loading, error, refreshStats } = useDashboardStats()

  const quickActions = [
    {
      title: 'Create Attestation',
      description: 'Link your GitHub to Ethereum address',
      icon: Add,
      color: 'primary',
      action: () => navigate('/create'),
      requiresWallet: true,
    },
    {
      title: 'Browse Attestations',
      description: 'Explore existing attestations',
      icon: Search,
      color: 'secondary',
      action: () => navigate('/browse'),
      requiresWallet: false,
    },
    {
      title: 'Verify Attestation',
      description: 'Check attestation validity',
      icon: VerifiedUser,
      color: 'success',
      action: () => navigate('/verify'),
      requiresWallet: false,
    },
  ]

  const StatCard = ({ title, value, icon: Icon, color, subtitle, loading: cardLoading }: any) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: `${color}.main`, mr: 2 }}>
            <Icon />
          </Avatar>
          <Box>
            {cardLoading ? (
              <Skeleton variant="text" width="80%" height={48} />
            ) : (
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {value.toLocaleString()}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
        </Box>
        {subtitle && !cardLoading && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  )

  return (
    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
      <Grid container spacing={3}>
        {/* Page Header */}
        <Grid item xs={12}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Overview of EAS attestations and quick actions
              </Typography>
            </Box>
            {error && (
              <Button
                variant="outlined"
                size="small"
                onClick={refreshStats}
                startIcon={<Refresh />}
              >
                Retry
              </Button>
            )}
          </Box>
        </Grid>

        {/* Error Display */}
        {error && (
          <Grid item xs={12}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          </Grid>
        )}

        {/* Wallet Connection Status */}
        {!isConnected && (
          <Grid item xs={12}>
            <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    ⚠️
                  </Avatar>
                  <Box>
                    <Typography variant="h6">Wallet Not Connected</Typography>
                    <Typography variant="body2">
                      Connect your wallet to create and manage attestations
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Statistics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Attestations"
            value={stats.total}
            icon={TrendingUp}
            color="primary"
            subtitle="All time"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Trusted Validator"
            value={stats.trustedValidator}
            icon={VerifiedUser}
            color="success"
            subtitle={stats.total > 0 ? `${((stats.trustedValidator / stats.total) * 100).toFixed(1)}% success rate` : 'No data'}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Unique Users"
            value={stats.uniqueUsers}
            icon={People}
            color="secondary"
            subtitle="Total unique users"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Revoked"
            value={stats.revoked}
            icon={Cancel}
            color="error"
            subtitle="Cancelled attestations"
            loading={loading}
          />
        </Grid>

        {/* Quick Actions Section Header */}
        <Grid item xs={12}>
          <Typography variant="h5" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>
            Quick Actions
          </Typography>
        </Grid>

        {/* Quick Actions Cards */}
        {quickActions.map((action) => {
          const IconComponent = action.icon
          const disabled = action.requiresWallet && !isConnected
          
          return (
            <Grid item xs={12} sm={6} md={4} key={action.title}>
              <Card 
                sx={{ 
                  height: '100%',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: disabled ? 'none' : 'translateY(-2px)',
                    boxShadow: disabled ? 1 : 4,
                  }
                }}
                onClick={disabled ? undefined : action.action}
              >
                <CardContent sx={{ textAlign: 'center', p: 3 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: `${action.color}.main`,
                      width: 56,
                      height: 56,
                      mx: 'auto',
                      mb: 2
                    }}
                  >
                    <IconComponent sx={{ fontSize: 32 }} />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {action.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {action.description}
                  </Typography>
                  {action.requiresWallet && !isConnected && (
                    <Chip 
                      label="Requires Wallet" 
                      size="small" 
                      color="warning"
                      variant="outlined"
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          )
        })}


      </Grid>
    </Box>
  )
}

export default Dashboard
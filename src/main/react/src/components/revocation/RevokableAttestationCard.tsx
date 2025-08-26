// Revokable attestation card component
import React from 'react'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Chip,
  Avatar,
  Link,
  CircularProgress,
  Alert
} from '@mui/material'
import {
  GitHub,
  Launch,
  Delete,
  CheckCircle,
  Warning,
  Error as ErrorIcon
} from '@mui/icons-material'
import { UserAttestation } from '../../types/revocationTypes'
// import { 
//   AttestationStatusBadge, 
//   ValidatorTrustBadge, 
//   NetworkBadge 
// } from '../verification/VerificationStatusBadge'

interface RevokableAttestationCardProps {
  attestation: UserAttestation
  onRevoke: (uid: string) => void
  isRevoking?: boolean
  revokeError?: string
}

export const RevokableAttestationCard: React.FC<RevokableAttestationCardProps> = ({
  attestation,
  onRevoke,
  isRevoking = false,
  revokeError
}) => {
  const formatTimestamp = (timestamp: bigint): string => {
    try {
      const date = new Date(Number(timestamp) * 1000)
      return `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`
    } catch {
      return 'Invalid date'
    }
  }

  const getGitHubUrl = (): string => {
    return `https://github.com/${attestation.identifier}`
  }

  const getTransactionUrl = (): string => {
    const baseUrls = {
      'base': 'https://basescan.org',
      'base-sepolia': 'https://sepolia.basescan.org'
    }
    const baseUrl = baseUrls[attestation.networkName as keyof typeof baseUrls] || baseUrls['base-sepolia']
    return `${baseUrl}/tx/${attestation.txHash}`
  }

  const getVerificationUrl = (): string => {
    return `/verify?uid=${attestation.uid}`
  }

  const getStatusLabel = (isValidValidator: boolean): string => {
    return isValidValidator ? 'TRUSTED' : 'UNKNOWN'
  }

  const getStatusColor = (isValidValidator: boolean): 'success' | 'warning' => {
    return isValidValidator ? 'success' : 'warning'
  }

  const getNetworkColor = (network: string): 'primary' | 'secondary' | 'default' => {
    switch (network) {
      case 'base': return 'primary'
      case 'base-sepolia': return 'secondary'
      default: return 'default'
    }
  }

  const canRevoke = !attestation.revoked && !isRevoking

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        {/* Header with GitHub info and status badges */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
            <GitHub />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Link 
              href={getGitHubUrl()}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ 
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                @{attestation.identifier}
              </Typography>
            </Link>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {attestation.recipient}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', alignItems: 'flex-end' }}>
            <Chip 
              label={getStatusLabel(attestation.isValidValidator)}
              color={getStatusColor(attestation.isValidValidator)}
              size="small"
            />
            {attestation.revoked && (
              <Chip 
                label="REVOKED"
                color="error"
                size="small"
                variant="filled"
              />
            )}
            {isRevoking && (
              <Chip 
                label="REVOKING"
                color="warning"
                size="small"
                variant="filled"
                icon={<CircularProgress size={12} color="inherit" />}
              />
            )}
            <Chip 
              label={attestation.networkName}
              color={getNetworkColor(attestation.networkName)}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Error display */}
        {revokeError && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            icon={<ErrorIcon />}
          >
            <Typography variant="body2">
              <strong>Revocation Failed:</strong> {revokeError}
            </Typography>
          </Alert>
        )}

        {/* Bottom section with timestamp and actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            Created: {formatTimestamp(attestation.time)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              size="small" 
              variant="outlined"
              component="a"
              href={getTransactionUrl()}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<Launch />}
            >
              Transaction
            </Button>
            <Button 
              size="small" 
              variant="outlined"
              component={Link}
              href={getVerificationUrl()}
            >
              Verify
            </Button>
            <Button 
              size="small" 
              variant="outlined"
              component="a"
              href={attestation.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<Launch />}
            >
              Proof
            </Button>
            
            {/* Revoke Button */}
            <Button
              size="small"
              variant="contained"
              color={attestation.revoked ? 'success' : 'error'}
              onClick={() => onRevoke(attestation.uid)}
              disabled={!canRevoke}
              startIcon={
                isRevoking ? (
                  <CircularProgress size={16} color="inherit" />
                ) : attestation.revoked ? (
                  <CheckCircle />
                ) : (
                  <Delete />
                )
              }
              sx={{
                minWidth: 100,
                ...(attestation.revoked && {
                  '&.Mui-disabled': {
                    backgroundColor: 'success.main',
                    color: 'success.contrastText',
                    opacity: 0.7
                  }
                })
              }}
            >
              {isRevoking 
                ? 'Revoking...' 
                : attestation.revoked 
                ? 'Revoked' 
                : 'Revoke'
              }
            </Button>
          </Box>
        </Box>

        {/* Additional details for revoked attestations */}
        {attestation.revoked && attestation.revocationTime > 0 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1, opacity: 0.7 }}>
            <Typography variant="caption" color="error.dark" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Warning fontSize="small" />
              Revoked on {formatTimestamp(attestation.revocationTime)}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
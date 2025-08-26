// Revocation confirmation dialog component
import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Divider,
  Chip,
  CircularProgress,
  Link
} from '@mui/material'
import {
  Warning,
  Delete,
  GitHub,
  AccountBalanceWallet,
  AccessTime
} from '@mui/icons-material'
import { RevocationConfirmDialogProps } from '../../types/revocationTypes'
import { revocationService } from '../../services/revocationService'

export const RevocationConfirmDialog: React.FC<RevocationConfirmDialogProps> = ({
  open,
  attestation,
  onConfirm,
  onCancel,
  isLoading
}) => {
  const [gasEstimate, setGasEstimate] = useState<{
    gasLimit: string
    gasPrice: string
    estimatedCost: string
    networkName: string
  } | null>(null)
  const [gasLoading, setGasLoading] = useState(false)
  const [gasError, setGasError] = useState<string | null>(null)

  // Load gas estimate when dialog opens
  useEffect(() => {
    if (open && attestation && !isLoading) {
      loadGasEstimate()
    }
  }, [open, attestation, isLoading])

  const loadGasEstimate = async () => {
    if (!attestation) return

    setGasLoading(true)
    setGasError(null)

    try {
      const estimate = await revocationService.estimateRevocationGas(
        attestation.uid,
        attestation.networkName
      )
      setGasEstimate(estimate)
    } catch (error) {
      setGasError(error instanceof Error ? error.message : 'Failed to estimate gas')
    } finally {
      setGasLoading(false)
    }
  }

  const formatTimestamp = (timestamp: bigint): string => {
    try {
      const date = new Date(Number(timestamp) * 1000)
      return `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`
    } catch {
      return 'Invalid date'
    }
  }

  const getNetworkDisplayName = (network: string): string => {
    switch (network) {
      case 'base':
        return 'Base Mainnet'
      case 'base-sepolia':
        return 'Base Sepolia'
      default:
        return network.toUpperCase()
    }
  }

  const getGitHubUrl = (): string => {
    if (!attestation) return '#'
    return `https://github.com/${attestation.identifier}`
  }

  if (!attestation) return null

  return (
    <Dialog 
      open={open} 
      onClose={onCancel} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Confirm Attestation Revocation
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Warning Message */}
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>⚠️ This action is permanent and cannot be undone.</strong>
            <br />
            Once revoked, this attestation will be marked as invalid and cannot be restored.
          </Typography>
        </Alert>

        {/* Attestation Details */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
            Attestation Details
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* GitHub Username */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GitHub sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                GitHub Username:
              </Typography>
              <Link
                href={getGitHubUrl()}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontWeight: 500 }}
              >
                @{attestation.identifier}
              </Link>
            </Box>

            {/* Ethereum Address */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalanceWallet sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Ethereum Address:
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  wordBreak: 'break-all'
                }}
              >
                {attestation.recipient}
              </Typography>
            </Box>

            {/* Creation Date */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTime sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Created:
              </Typography>
              <Typography variant="body2">
                {formatTimestamp(attestation.time)}
              </Typography>
            </Box>

            {/* Network and Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip 
                label={getNetworkDisplayName(attestation.networkName)}
                color="primary"
                size="small"
                variant="outlined"
              />
              <Chip
                label={attestation.isValidValidator ? 'TRUSTED' : 'UNKNOWN'}
                color={attestation.isValidValidator ? 'success' : 'warning'}
                size="small"
              />
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Gas Estimate */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Transaction Cost Estimate
          </Typography>
          
          {gasLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Calculating gas estimate...
              </Typography>
            </Box>
          )}

          {gasError && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              <Typography variant="body2">
                Unable to estimate gas cost: {gasError}
              </Typography>
            </Alert>
          )}

          {gasEstimate && !gasLoading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2">
                <strong>Estimated Cost:</strong> ~{parseFloat(gasEstimate.estimatedCost).toFixed(6)} ETH
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Gas Price: {parseFloat(gasEstimate.gasPrice).toFixed(2)} gwei
              </Typography>
            </Box>
          )}
        </Box>

        {/* UID Display */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Attestation UID:
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              wordBreak: 'break-all',
              color: 'text.primary'
            }}
          >
            {attestation.uid}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button 
          onClick={onCancel}
          disabled={isLoading}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          color="error"
          variant="contained"
          startIcon={
            isLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <Delete />
            )
          }
          sx={{ minWidth: 120 }}
        >
          {isLoading ? 'Revoking...' : 'Revoke Attestation'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
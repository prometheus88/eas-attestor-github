// Status badge components for attestation verification
import React from 'react'
import { Chip } from '@mui/material'
import { 
  CheckCircle, 
  Cancel, 
  Warning, 
  HelpOutline,
  Shield,
  Error 
} from '@mui/icons-material'
import { ValidationStatus, ValidatorTrustLevel } from '../../types/verificationTypes'

interface AttestationStatusBadgeProps {
  status: ValidationStatus
  size?: 'small' | 'medium'
}

export const AttestationStatusBadge: React.FC<AttestationStatusBadgeProps> = ({ 
  status, 
  size = 'medium' 
}) => {
  const getStatusConfig = (status: ValidationStatus) => {
    switch (status) {
      case 'active':
        return {
          label: 'ACTIVE',
          color: 'success' as const,
          icon: <CheckCircle sx={{ fontSize: size === 'small' ? 14 : 16 }} />
        }
      case 'revoked':
        return {
          label: 'REVOKED',
          color: 'error' as const,
          icon: <Cancel sx={{ fontSize: size === 'small' ? 14 : 16 }} />
        }
      case 'expired':
        return {
          label: 'EXPIRED',
          color: 'warning' as const,
          icon: <Warning sx={{ fontSize: size === 'small' ? 14 : 16 }} />
        }
      case 'invalid':
        return {
          label: 'INVALID',
          color: 'error' as const,
          icon: <Error sx={{ fontSize: size === 'small' ? 14 : 16 }} />
        }
      default:
        return {
          label: 'UNKNOWN',
          color: 'default' as const,
          icon: <HelpOutline sx={{ fontSize: size === 'small' ? 14 : 16 }} />
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      icon={config.icon}
      sx={{
        fontWeight: 600,
        '& .MuiChip-icon': {
          marginLeft: '4px'
        }
      }}
    />
  )
}

interface ValidatorTrustBadgeProps {
  trustLevel: ValidatorTrustLevel
  validatorAddress?: string
  size?: 'small' | 'medium'
}

export const ValidatorTrustBadge: React.FC<ValidatorTrustBadgeProps> = ({ 
  trustLevel, 
  size = 'medium' 
}) => {
  const getTrustConfig = (level: ValidatorTrustLevel) => {
    switch (level) {
      case 'trusted':
        return {
          label: 'TRUSTED',
          color: 'success' as const,
          icon: <Shield sx={{ fontSize: size === 'small' ? 14 : 16 }} />
        }
      case 'unknown':
        return {
          label: 'UNKNOWN',
          color: 'warning' as const,
          icon: <HelpOutline sx={{ fontSize: size === 'small' ? 14 : 16 }} />
        }
      case 'untrusted':
        return {
          label: 'UNTRUSTED',
          color: 'error' as const,
          icon: <Warning sx={{ fontSize: size === 'small' ? 14 : 16 }} />
        }
      default:
        return {
          label: 'UNKNOWN',
          color: 'default' as const,
          icon: <HelpOutline sx={{ fontSize: size === 'small' ? 14 : 16 }} />
        }
    }
  }

  const config = getTrustConfig(trustLevel)

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      icon={config.icon}
      sx={{
        fontWeight: 600,
        '& .MuiChip-icon': {
          marginLeft: '4px'
        }
      }}
    />
  )
}

interface NetworkBadgeProps {
  networkName: string
  size?: 'small' | 'medium'
}

export const NetworkBadge: React.FC<NetworkBadgeProps> = ({ 
  networkName, 
  size = 'medium' 
}) => {
  const getNetworkConfig = (network: string) => {
    switch (network) {
      case 'base':
        return {
          label: 'Base Mainnet',
          color: 'primary' as const
        }
      case 'base-sepolia':
        return {
          label: 'Base Sepolia',
          color: 'secondary' as const
        }
      default:
        return {
          label: network.toUpperCase(),
          color: 'default' as const
        }
    }
  }

  const config = getNetworkConfig(networkName)

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      variant="outlined"
      sx={{
        fontWeight: 500,
        borderWidth: 2
      }}
    />
  )
}
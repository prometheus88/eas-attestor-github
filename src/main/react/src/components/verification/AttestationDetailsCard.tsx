// Comprehensive attestation details display component
import React, { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  IconButton,
  Link,
  Stack,
  Button,
  Collapse,
  Alert,
  Tooltip
} from '@mui/material'
import {
  ContentCopy,
  OpenInNew,
  ExpandMore,
  ExpandLess,
  GitHub,
  AccountBalanceWallet,
  Shield,
  AccessTime,
  Link as LinkIcon,
  CheckCircle
} from '@mui/icons-material'
import { AttestationDetails, ValidationStatus, ValidatorTrustLevel } from '../../types/verificationTypes'
import { 
  AttestationStatusBadge, 
  ValidatorTrustBadge, 
  NetworkBadge 
} from './VerificationStatusBadge'

interface AttestationDetailsCardProps {
  attestation: AttestationDetails
}

interface DetailRowProps {
  label: string
  value: string | React.ReactNode
  copyable?: boolean
  copyValue?: string // Separate string value for copying when value is a React node
  linkable?: boolean
  icon?: React.ReactNode
}

const DetailRow: React.FC<DetailRowProps> = ({ 
  label, 
  value, 
  copyable = false, 
  copyValue,
  linkable = false,
  icon 
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const textToCopy = copyValue || (typeof value === 'string' ? value : '')
    if (textToCopy) {
      try {
        // Try modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(textToCopy)
        } else {
          // Fallback for older browsers or non-secure contexts
          const textArea = document.createElement('textarea')
          textArea.value = textToCopy
          textArea.style.position = 'fixed'
          textArea.style.left = '-999999px'
          textArea.style.top = '-999999px'
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          document.execCommand('copy')
          textArea.remove()
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy:', error)
        // Show error feedback to user
        setCopied(false)
      }
    }
  }

  const renderValue = () => {
    if (typeof value === 'string' && linkable && (value.startsWith('http') || value.startsWith('https'))) {
      return (
        <Link 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          sx={{ 
            wordBreak: 'break-all',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}
        >
          {value}
          <OpenInNew sx={{ fontSize: 14 }} />
        </Link>
      )
    }
    
    if (typeof value === 'string' && copyable) {
      return (
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: '0.85rem',
            wordBreak: 'break-all',
            color: 'text.secondary'
          }}
        >
          {value}
        </Typography>
      )
    }
    
    return typeof value === 'string' ? (
      <Typography variant="body2" color="text.secondary">
        {value}
      </Typography>
    ) : value
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start',
      py: 1.5,
      borderBottom: 1,
      borderColor: 'divider',
      '&:last-child': { borderBottom: 0 }
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
        {icon}
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {label}
        </Typography>
      </Box>
      
      <Box sx={{ flex: 1, ml: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          {renderValue()}
        </Box>
        
        {copyable && typeof value === 'string' && (
          <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
            <IconButton size="small" onClick={handleCopy}>
              {copied ? <CheckCircle color="success" /> : <ContentCopy />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}

export const AttestationDetailsCard: React.FC<AttestationDetailsCardProps> = ({ 
  attestation 
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  const getValidationStatus = (): ValidationStatus => {
    if (attestation.revoked) return 'revoked'
    if (attestation.expirationTime > 0 && attestation.expirationTime < Date.now() / 1000) return 'expired'
    return 'active'
  }

  const getValidatorTrustLevel = (): ValidatorTrustLevel => {
    return attestation.isValidValidator ? 'trusted' : 'unknown'
  }

  const formatTimestamp = (timestamp: bigint): string => {
    try {
      const date = new Date(Number(timestamp) * 1000)
      return date.toLocaleString()
    } catch {
      return 'Invalid date'
    }
  }

  // const formatAddress = (address: string): string => {
  //   if (address.length < 10) return address
  //   return `${address.slice(0, 6)}...${address.slice(-4)}`
  // }

  return (
    <Card sx={{ width: '100%', mt: 3 }}>
      <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            ✅ Attestation Verified
          </Typography>
          
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <AttestationStatusBadge status={getValidationStatus()} />
            <ValidatorTrustBadge 
              trustLevel={getValidatorTrustLevel()}
              validatorAddress={attestation.decodedData.validator}
            />
            <NetworkBadge networkName={attestation.networkName} />
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Identity Information */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Identity Information
          </Typography>
          
          <Stack spacing={0}>
            <DetailRow
              label="GitHub Username"
              value={attestation.decodedData.identifier}
              icon={<GitHub sx={{ fontSize: 18, color: 'text.secondary' }} />}
            />
            
            <DetailRow
              label="Ethereum Address"
              value={attestation.decodedData.ethereumAddress}
              copyable={true}
              icon={<AccountBalanceWallet sx={{ fontSize: 18, color: 'text.secondary' }} />}
            />
            
            <DetailRow
              label="Domain"
              value={attestation.decodedData.domain}
              icon={<LinkIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
            />
            
            <DetailRow
              label="Proof URL"
              value={attestation.decodedData.proofUrl}
              linkable={true}
              icon={<OpenInNew sx={{ fontSize: 18, color: 'text.secondary' }} />}
            />
          </Stack>
        </Box>

        {/* Verification Details */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Verification Details
          </Typography>
          
          <Stack spacing={0}>
            <DetailRow
              label="Attestation UID"
              value={attestation.uid}
              copyable={true}
            />
            
            <DetailRow
              label="Validator"
              value={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                      fontSize: '0.85rem',
                      wordBreak: 'break-all',
                      flex: 1
                    }}
                  >
                    {attestation.decodedData.validator}
                  </Typography>
                  <ValidatorTrustBadge 
                    trustLevel={getValidatorTrustLevel()}
                    size="small"
                  />
                </Box>
              }
              copyable={true}
              copyValue={attestation.decodedData.validator}
              icon={<Shield sx={{ fontSize: 18, color: 'text.secondary' }} />}
            />
            
            <DetailRow
              label="Created"
              value={formatTimestamp(attestation.time)}
              icon={<AccessTime sx={{ fontSize: 18, color: 'text.secondary' }} />}
            />
            
            <DetailRow
              label="Network"
              value={<NetworkBadge networkName={attestation.networkName} size="small" />}
            />
          </Stack>
        </Box>

        {/* Technical Details (Collapsible) */}
        <Box>
          <Button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            startIcon={showTechnicalDetails ? <ExpandLess /> : <ExpandMore />}
            sx={{ mb: 2 }}
          >
            Technical Details
          </Button>
          
          <Collapse in={showTechnicalDetails}>
            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
              <Stack spacing={0}>
                <DetailRow
                  label="Attester"
                  value={attestation.attester}
                  copyable={true}
                />
                
                <DetailRow
                  label="Recipient"
                  value={attestation.recipient}
                  copyable={true}
                />
                
                <DetailRow
                  label="Schema"
                  value={attestation.schema}
                  copyable={true}
                />
                
                {attestation.refUID !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <DetailRow
                    label="Reference UID"
                    value={attestation.refUID}
                    copyable={true}
                  />
                )}
                
                {attestation.expirationTime > 0 && (
                  <DetailRow
                    label="Expires"
                    value={formatTimestamp(attestation.expirationTime)}
                  />
                )}
                
                {attestation.revoked && attestation.revocationTime > 0 && (
                  <DetailRow
                    label="Revoked"
                    value={formatTimestamp(attestation.revocationTime)}
                  />
                )}
              </Stack>
            </Box>
          </Collapse>
        </Box>

        {/* Trust Information */}
        {getValidatorTrustLevel() === 'trusted' && (
          <Alert severity="success" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>✅ Verified Attestation</strong><br />
              This attestation was created by a trusted validator and has been verified as authentic.
            </Typography>
          </Alert>
        )}
        
        {getValidatorTrustLevel() === 'unknown' && (
          <Alert severity="warning" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>⚠️ Unknown Validator</strong><br />
              This attestation was created by an unknown validator. While the attestation data is valid, 
              the validator's trustworthiness cannot be verified.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
// Main verification form component
import React, { useState } from 'react'
import {
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  Alert,
  Stack,
  InputAdornment,
  Collapse
} from '@mui/material'
import {
  Search,
  ExpandMore,
  ExpandLess,
  Info
} from '@mui/icons-material'
import { NetworkSelector } from './NetworkSelector'
import { VerificationHookData } from '../../types/verificationTypes'

interface VerifyAttestationFormProps {
  hookData: VerificationHookData
}

export const VerifyAttestationForm: React.FC<VerifyAttestationFormProps> = ({ hookData }) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const {
    uid,
    selectedNetwork,
    isLoading,
    error,
    setUID,
    setSelectedNetwork,
    verifyAttestation
  } = hookData

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!uid.trim()) return
    
    await verifyAttestation(uid.trim())
  }

  const handleUIDChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUID(event.target.value)
  }

  const isValidUID = (value: string): boolean => {
    return /^0x[a-fA-F0-9]{64}$/.test(value.trim())
  }

  const getUIDHelperText = (): string => {
    if (!uid) return 'Enter the 64-character attestation UID starting with 0x'
    if (!isValidUID(uid)) return 'Invalid format. UID must be 64 hex characters starting with 0x'
    return ''
  }

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            🔍 Verify Attestation
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Verify GitHub-to-Ethereum attestations by entering the EAS UID below
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            {/* UID Input */}
            <TextField
              label="Attestation UID"
              value={uid}
              onChange={handleUIDChange}
              placeholder="0x1234567890abcdef..."
              fullWidth
              required
              error={uid.length > 0 && !isValidUID(uid)}
              helperText={getUIDHelperText()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  fontSize: '0.9rem'
                }
              }}
            />

            {/* Advanced Options */}
            <Box>
              <Button
                onClick={() => setShowAdvanced(!showAdvanced)}
                startIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
                sx={{ mb: 2 }}
                variant="text"
                color="primary"
              >
                Advanced Options
              </Button>
              
              <Collapse in={showAdvanced}>
                <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'divider' }}>
                  <NetworkSelector
                    selectedNetwork={selectedNetwork}
                    onNetworkChange={setSelectedNetwork}
                    disabled={isLoading}
                    showAutoDetect={true}
                  />
                </Box>
              </Collapse>
            </Box>

            {/* Error Display */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Info Box */}
            <Alert severity="info" icon={<Info />}>
              <Typography variant="body2">
                <strong>How it works:</strong> Enter an attestation UID to verify its authenticity and view details. 
                No wallet connection required - we'll search across supported networks automatically.
              </Typography>
            </Alert>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isLoading || !uid.trim() || !isValidUID(uid)}
              startIcon={!isLoading ? <Search /> : undefined}
              sx={{ 
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600
              }}
            >
              {isLoading ? 'Verifying...' : 'Verify Attestation'}
            </Button>
          </Stack>
        </form>

        {/* Quick Examples */}
        <Box sx={{ mt: 4, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <strong>Example UID format:</strong>
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              fontSize: '0.8rem',
              color: 'text.secondary',
              wordBreak: 'break-all'
            }}
          >
            0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}
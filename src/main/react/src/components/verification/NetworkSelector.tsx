// Network selector component for attestation verification
import React, { useState, useEffect } from 'react'
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  Alert
} from '@mui/material'
import { 
  Language,
  CheckCircle 
} from '@mui/icons-material'
import { verificationService } from '../../services/verificationService'
import { NetworkInfo } from '../../types/verificationTypes'
import { useWallet } from '../../contexts/WalletContext'

interface NetworkSelectorProps {
  selectedNetwork: string | null
  onNetworkChange: (network: string | null) => void
  disabled?: boolean
  showAutoDetect?: boolean
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  selectedNetwork,
  onNetworkChange,
  disabled = false,
  showAutoDetect = true
}) => {
  const [availableNetworks, setAvailableNetworks] = useState<NetworkInfo[]>([])
  const [detectedNetwork, setDetectedNetwork] = useState<NetworkInfo | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const { isConnected, network: walletNetwork, chainId } = useWallet()

  // Load available networks on mount
  useEffect(() => {
    const networks = verificationService.getAvailableNetworks()
    setAvailableNetworks(networks)
  }, [])

  // Auto-detect network when wallet is connected or network changes
  useEffect(() => {
    const detectNetwork = async () => {
      if (!isConnected || !showAutoDetect) return

      setIsDetecting(true)
      try {
        const detected = await verificationService.detectCurrentNetwork()
        setDetectedNetwork(detected)
        
        // Auto-select detected network if no network is currently selected
        if (detected && !selectedNetwork) {
          onNetworkChange(detected.name)
        }
      } catch (error) {
        console.warn('Failed to detect network:', error)
      } finally {
        setIsDetecting(false)
      }
    }

    detectNetwork()
  }, [isConnected, walletNetwork, chainId, showAutoDetect, selectedNetwork, onNetworkChange]) // Listen to wallet network changes

  const handleNetworkChange = (networkName: string) => {
    if (networkName === 'auto') {
      onNetworkChange(null)
    } else {
      onNetworkChange(networkName)
    }
  }

  return (
    <Box>
      <FormControl fullWidth disabled={disabled}>
        <InputLabel 
          id="network-selector-label"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            // Fix focus ring positioning
            '&.Mui-focused': {
              transform: 'translate(14px, -9px) scale(0.75)'
            }
          }}
        >
          <Language sx={{ fontSize: 16 }} />
          Network
        </InputLabel>
        <Select
          labelId="network-selector-label"
          value={selectedNetwork || 'auto'}
          onChange={(e) => handleNetworkChange(e.target.value)}
          label="🌐 Network"
        >
          {/* Auto-detect option */}
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

          {/* Available networks */}
          {availableNetworks.map((network) => (
            <MenuItem key={network.name} value={network.name}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography>{network.displayName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  (Chain ID: {network.chainId})
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Network detection info */}
      {showAutoDetect && (
        <Box sx={{ mt: 1 }}>
          {!isConnected && (
            <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
              Connect your wallet for automatic network detection, or manually select a network to search.
            </Alert>
          )}
          
          {isConnected && detectedNetwork && selectedNetwork === null && (
            <Alert severity="success" sx={{ fontSize: '0.875rem' }}>
              Auto-detected network: <strong>{detectedNetwork.displayName}</strong>
            </Alert>
          )}
          
          {isConnected && !detectedNetwork && !isDetecting && (
            <Alert severity="warning" sx={{ fontSize: '0.875rem' }}>
              Connected to unsupported network. Please switch to Base or Base Sepolia, or select a network manually.
            </Alert>
          )}
          
          {selectedNetwork === null && !isConnected && (
            <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
              Will search all supported networks (Base, Base Sepolia) for the attestation.
            </Alert>
          )}
        </Box>
      )}
    </Box>
  )
}
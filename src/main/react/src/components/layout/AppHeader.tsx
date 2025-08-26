import React, { useState } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Chip,
  Avatar,
  Box,
  Menu,
  MenuItem,
  Tooltip,
  CircularProgress,
  useMediaQuery,
} from '@mui/material'
import {
  Menu as MenuIcon,
  AccountBalanceWallet,
  ContentCopy,
  ExitToApp,
  MoreVert,

} from '@mui/icons-material'
import { useTheme as useMUITheme } from '@mui/material/styles'

import { useWallet } from '../../contexts/WalletContext'
import logoImage from '../../assets/images/eas-attestor-logo.png'

interface AppHeaderProps {
  onDrawerToggle: () => void
}

const AppHeader: React.FC<AppHeaderProps> = ({ onDrawerToggle }) => {
  const muiTheme = useMUITheme()

  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))
  
  return (
    <AppBar 
      elevation={1}
      sx={{ 
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        {/* Mobile Menu Button */}
        {isMobile && (
          <IconButton 
            edge="start" 
            onClick={onDrawerToggle}
            sx={{ color: 'text.primary' }}
          >
            <MenuIcon />
          </IconButton>
        )}
        
        {/* Logo */}
        <Box
          sx={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            height: '50px'
          }}
        >
          <img 
            src={logoImage} 
            alt="EAS Attestor Logo"
            style={{
              height: '50px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
        </Box>
        
        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />
        
        {/* Network Chip */}
        <NetworkChip />
        
        {/* Wallet Connection */}
        <WalletButton />
        
        {/* Theme Toggle - Moved to navigation footer */}
        
        {/* User Menu */}
        <MoreOptionsMenu />
      </Toolbar>
    </AppBar>
  )
}

// Network Display Component
const NetworkChip: React.FC = () => {
  const { network, isConnected } = useWallet()
  
  const getNetworkConfig = (networkName: string | null) => {
    switch (networkName) {
      case 'base':
        return {
          label: 'Base Mainnet',
          color: 'success' as const,
          icon: '🟢'
        }
      case 'base-sepolia':
        return {
          label: 'Base Sepolia',
          color: 'warning' as const,
          icon: '🟡'
        }
      default:
        return {
          label: isConnected ? 'Wrong Network' : 'Not Connected',
          color: isConnected ? 'error' as const : 'default' as const,
          icon: isConnected ? '🔴' : '⚫'
        }
    }
  }
  
  const config = getNetworkConfig(network)
  const muiTheme = useMUITheme()
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))
  
  return (
    <Tooltip title={`Connected to ${config.label}`}>
      <Chip
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span>{config.icon}</span>
            <Typography variant="body2">
              {isMobile ? config.label.split(' ')[0] : config.label}
            </Typography>
          </Box>
        }
        color={config.color}
        variant="outlined"
        size="small"
        sx={{ 
          fontWeight: 500,
          '& .MuiChip-label': {
            px: 1
          }
        }}
      />
    </Tooltip>
  )
}

// Wallet Connection Component
const WalletButton: React.FC = () => {
  const { 
    address, 
    isConnected, 
    isConnecting, 
    connect, 
    disconnect 
  } = useWallet()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const muiTheme = useMUITheme()
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))
  
  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setAnchorEl(null)
    }
  }

  // Disconnected state
  if (!isConnected) {
    return (
      <Button
        variant="contained"
        startIcon={
          isConnecting ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <AccountBalanceWallet />
          )
        }
        onClick={connect}
        disabled={isConnecting}
        sx={{ 
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 500
        }}
      >
        {isConnecting ? 'Connecting...' : (isMobile ? 'Connect' : 'Connect Wallet')}
      </Button>
    )
  }
  
  // Connected state
  return (
    <>
      <Button
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ 
          borderRadius: 2,
          textTransform: 'none',
          gap: 1,
          px: 2
        }}
      >
        <Avatar 
          sx={{ 
            width: 24, 
            height: 24, 
            bgcolor: 'primary.main',
            fontSize: '0.75rem'
          }}
        >
          {address!.slice(2, 4).toUpperCase()}
        </Avatar>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {`${address!.slice(0, 6)}...${address!.slice(-4)}`}
        </Typography>
      </Button>
      
      {/* Wallet Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: { 
            mt: 1,
            minWidth: 200,
            borderRadius: 2
          }
        }}
      >
        <MenuItem onClick={copyAddress}>
          <ContentCopy sx={{ mr: 2 }} />
          Copy Address
        </MenuItem>
        <MenuItem onClick={() => { disconnect(); setAnchorEl(null) }}>
          <ExitToApp sx={{ mr: 2 }} />
          Disconnect
        </MenuItem>
      </Menu>
    </>
  )
}

// More Options Menu Component
const MoreOptionsMenu: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  
  return (
    <>
      <IconButton 
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ color: 'text.primary' }}
      >
        <MoreVert />
      </IconButton>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: { 
            mt: 1,
            minWidth: 180,
            borderRadius: 2
          }
        }}
      >
        <MenuItem onClick={() => { window.open('https://github.com/allenday/eas-attestor-github'); setAnchorEl(null) }}>
          GitHub Repo
        </MenuItem>
      </Menu>
    </>
  )
}

export default AppHeader
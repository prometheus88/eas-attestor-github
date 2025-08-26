import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Tooltip,
  useMediaQuery,
  Box,
  Typography,
  IconButton,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  Dashboard,
  Search,
  Add,
  VerifiedUser,
  Cancel,
  Folder,
  Brightness4,
  Brightness7,
} from '@mui/icons-material'
import { useTheme as useAppTheme } from '../../contexts/ThemeContext'

const drawerWidth = 280

interface NavigationProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

// Navigation items configuration
interface NavigationItem {
  path: string
  icon: any
  label: string
  current: boolean
  badge?: string
}

interface NavigationSection {
  section: string
  items: NavigationItem[]
}

const navigationItems: NavigationSection[] = [
  // Current functionality
  {
    section: 'Core Features',
    items: [
      { path: '/', icon: Dashboard, label: 'Dashboard', current: true },
      { path: '/browse', icon: Search, label: 'Browse Attestations', current: true },
      { path: '/create', icon: Add, label: 'Create Attestation', current: true },
      { path: '/verify', icon: VerifiedUser, label: 'Verify Attestation', current: true },
      { path: '/revoke', icon: Cancel, label: 'Revoke Attestation', current: true },
      { path: '/repositories', icon: Folder, label: 'Repository Management', current: true },
    ]
  },
]

const Navigation: React.FC<NavigationProps> = ({ mobileOpen, onMobileClose }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const navigate = useNavigate()
  const location = useLocation()
  const { mode, toggleMode } = useAppTheme()

  const handleNavigation = (path: string, current: boolean) => {
    if (current) {
      navigate(path)
    }
    if (isMobile) {
      onMobileClose()
    }
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
          Navigation
        </Typography>
      </Box>

      {/* Navigation Lists */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {navigationItems.map((section, sectionIndex) => (
          <Box key={section.section}>
            {/* Section Header */}
            <Box sx={{ px: 2, py: 1 }}>
              <Typography 
                variant="overline" 
                sx={{ 
                  fontWeight: 600, 
                  color: 'text.secondary',
                  fontSize: '0.75rem'
                }}
              >
                {section.section}
              </Typography>
            </Box>

            {/* Section Items */}
            <List sx={{ py: 0 }}>
              {section.items.map((item) => {
                const isActive = location.pathname === item.path
                const IconComponent = item.icon

                return (
                  <ListItem key={item.path} disablePadding>
                    <Tooltip 
                      title={item.current ? '' : `${item.label} - Coming Soon`}
                      placement="right"
                    >
                      <ListItemButton
                        onClick={() => handleNavigation(item.path, item.current)}
                        disabled={!item.current}
                        sx={{
                          mx: 1,
                          my: 0.5,
                          borderRadius: 2,
                          backgroundColor: isActive ? 'primary.main' : 'transparent',
                          color: isActive ? 'primary.contrastText' : (item.current ? 'text.primary' : 'text.disabled'),
                          '&:hover': {
                            backgroundColor: isActive ? 'primary.dark' : (item.current ? 'action.hover' : 'transparent'),
                          },
                          '&.Mui-disabled': {
                            opacity: 0.6,
                          },
                        }}
                      >
                        <ListItemIcon sx={{ 
                          color: 'inherit',
                          minWidth: 40,
                        }}>
                          <IconComponent />
                        </ListItemIcon>
                        <ListItemText 
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: '0.875rem',
                            fontWeight: isActive ? 600 : 500,
                          }}
                        />
                        {item.badge && (
                          <Chip 
                            size="small" 
                            label={item.badge}
                            color={item.badge === 'Soon' ? 'secondary' : 'default'}
                            sx={{ 
                              height: 20,
                              fontSize: '0.65rem',
                              '& .MuiChip-label': { px: 1 }
                            }}
                          />
                        )}
                      </ListItemButton>
                    </Tooltip>
                  </ListItem>
                )
              })}
            </List>

            {/* Add divider between sections */}
            {sectionIndex < navigationItems.length - 1 && (
              <Divider sx={{ mx: 2, my: 1 }} />
            )}
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', height: '90px' }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={toggleMode} sx={{ color: 'text.secondary' }}>
            {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
          <Typography variant="caption" color="text.secondary">
            EAS Attestor v0.1.0
          </Typography>
        </Box>
      </Box>
    </Box>
  )

  return (
    <Box
      component="nav"
      sx={{ flexShrink: 0 }}
    >
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            position: 'fixed',
            height: '100vh',
            top: 0, // Start from top since header is now fixed above
            zIndex: 1200,
          },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  )
}

export default Navigation
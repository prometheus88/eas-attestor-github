import React, { useState } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import AppHeader from './AppHeader'
import Navigation from './Navigation'
import BottomNavigation from './BottomNavigation'

interface AppShellProps {
  children: React.ReactNode
}

const DRAWER_WIDTH = 280

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const handleDrawerToggle = () => {
    setMobileDrawerOpen(!mobileDrawerOpen)
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Left: Navigation Drawer (temporary on mobile, permanent on md+) */}
      <Navigation
        mobileOpen={mobileDrawerOpen}
        onMobileClose={() => setMobileDrawerOpen(false)}
        // Make sure your Navigation uses variant="permanent" on md+ with width=DRAWER_WIDTH
      />

      {/* Header (fixed) – offset by drawer on md+ so it truly spans visible width */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: { xs: 0, md: `${DRAWER_WIDTH}px` },
          width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <AppHeader onDrawerToggle={handleDrawerToggle} />
      </Box>

      {/* Right: Main content column */}
      <Box
        component="main"
        sx={{
          // Sit to the right of the drawer on md+, column on mobile
          ml: { md: `${DRAWER_WIDTH}px` },

          // Layout
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minWidth: 0,            // critical so Grid spacing doesn't force overflow
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',

          // Space for the fixed header - enough to clear the header height
          pt: { xs: 8, md: 10 },   // Increased to clear header (64px on desktop)

          // Gutters that do NOT cause stretching - equal spacing on both sides
          pl: { xs: 2, md: 3 },   // Left padding (same as right for visual balance)
          pr: { xs: 2, md: 3 },   // Right padding (same as left for visual balance)
          pb: 3,

          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>

      {isMobile && <BottomNavigation />}
    </Box>
  )
}

export default AppShell
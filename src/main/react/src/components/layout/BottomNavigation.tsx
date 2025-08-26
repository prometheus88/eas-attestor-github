import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BottomNavigation as MUIBottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@mui/material'
import {
  Dashboard,
  Search,
  Add,
  VerifiedUser,
  Settings,
} from '@mui/icons-material'

// Core navigation items for mobile bottom navigation
const bottomNavItems = [
  { path: '/', icon: Dashboard, label: 'Dashboard' },
  { path: '/browse', icon: Search, label: 'Browse' },
  { path: '/create', icon: Add, label: 'Create' },
  { path: '/verify', icon: VerifiedUser, label: 'Verify' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

const BottomNavigation: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
    navigate(newValue)
  }

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0,
        zIndex: 1000,
        borderTop: 1,
        borderColor: 'divider',
      }} 
      elevation={3}
    >
      <MUIBottomNavigation
        value={location.pathname}
        onChange={handleChange}
        showLabels
        sx={{
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            '&.Mui-selected': {
              color: 'primary.main',
            },
          },
        }}
      >
        {bottomNavItems.map((item) => {
          const IconComponent = item.icon
          return (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              value={item.path}
              icon={<IconComponent />}
            />
          )
        })}
      </MUIBottomNavigation>
    </Paper>
  )
}

export default BottomNavigation
import { Routes, Route } from 'react-router-dom'
import { Box } from '@mui/material'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import Browse from './pages/Browse'
import Create from './pages/Create'
import Verify from './pages/Verify'
import Revoke from './pages/Revoke'
import Repositories from './pages/Repositories'

function App() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppShell>
        <Routes>
          {/* Current functionality pages */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/create" element={<Create />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/revoke" element={<Revoke />} />
          <Route path="/repositories" element={<Repositories />} />
        </Routes>
      </AppShell>
    </Box>
  )
}

export default App
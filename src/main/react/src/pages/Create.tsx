import React from 'react'
import { Box } from '@mui/material'
import CreateAttestationWizard from '../components/forms/CreateAttestationWizard'

const Create: React.FC = () => {
  return (
    <Box 
      sx={{ 
        flexGrow: 1, 
        width: '100%',
        maxWidth: 'none',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'visible',
        p: 3
      }}
    >
      <CreateAttestationWizard />
    </Box>
  )
}

export default Create
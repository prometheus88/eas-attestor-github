import React, { useEffect } from 'react'
import {
  Box,
  Grid,
  Container
} from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { useVerifyAttestation } from '../hooks/useVerifyAttestation'
import { VerifyAttestationForm } from '../components/verification/VerifyAttestationForm'
import { AttestationDetailsCard } from '../components/verification/AttestationDetailsCard'

const Verify: React.FC = () => {
  const [searchParams] = useSearchParams()
  const hookData = useVerifyAttestation()
  const { result, setUID } = hookData

  // Auto-populate UID from URL parameters
  useEffect(() => {
    const uidFromUrl = searchParams.get('uid')
    if (uidFromUrl && uidFromUrl.trim()) {
      setUID(uidFromUrl.trim())
    }
  }, [searchParams, setUID])

  return (
    <Box sx={{ flexGrow: 1, minWidth: 0, py: 3 }}>
      <Container maxWidth="lg">
        <Grid container spacing={3} justifyContent="center">
          {/* Verification Form */}
          <Grid item xs={12} md={10} lg={8}>
            <VerifyAttestationForm hookData={hookData} />
          </Grid>

          {/* Verification Results */}
          {result?.success && result.attestation && (
            <Grid item xs={12} md={10} lg={8}>
              <AttestationDetailsCard attestation={result.attestation} />
            </Grid>
          )}
        </Grid>
      </Container>
    </Box>
  )
}

export default Verify
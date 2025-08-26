import React from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Avatar,
  Link,
} from '@mui/material'
import {
  GitHub,
  Launch,
} from '@mui/icons-material'
import { ProcessedAttestation, easService } from '../../services/easService'
import { getStatusColor, getStatusLabel, getNetworkColor } from '../../utils/attestationUtils'

export interface AttestationCardProps {
  attestation: ProcessedAttestation
  onRevoke: (uid: string) => Promise<void>
  canRevoke: boolean
}

export const AttestationCard: React.FC<AttestationCardProps> = ({ 
  attestation, 
  onRevoke, 
  canRevoke 
}) => (
  <Card sx={{ mb: 2 }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
          <GitHub />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Link 
            href={easService.getGitHubUrl(attestation)}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ 
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
              @{attestation.identifier}
            </Typography>
          </Link>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {attestation.recipient}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', opacity: 0.7 }}>
            UID: {attestation.uid}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', alignItems: 'flex-end' }}>
          <Chip 
            label={getStatusLabel(attestation.isValidValidator)}
            color={getStatusColor(attestation.isValidValidator)}
            size="small"
          />
          {attestation.revoked && (
            <Chip 
              label="REVOKED"
              color="error"
              size="small"
              variant="filled"
            />
          )}
          <Chip 
            label={attestation.network}
            color={getNetworkColor(attestation.network)}
            size="small"
            variant="outlined"
          />
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          Created: {attestation.timeCreated.toLocaleDateString()} at {attestation.timeCreated.toLocaleTimeString()}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            size="small" 
            variant="outlined"
            component="a"
            href={easService.getTransactionUrl(attestation)}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<Launch />}
          >
            Transaction
          </Button>
          <Button 
            size="small" 
            variant="outlined"
            component={Link}
            href={easService.getVerificationUrl(attestation)}
          >
            Verify
          </Button>
          <Button 
            size="small" 
            variant="outlined"
            component="a"
            href={attestation.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<Launch />}
          >
            Proof
          </Button>
          {canRevoke && !attestation.revoked && (
            <Button 
              size="small" 
              variant="outlined"
              color="error"
              onClick={() => onRevoke(attestation.uid)}
              sx={{ minWidth: 'auto' }}
            >
              Revoke
            </Button>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
)
import React from 'react'
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Box,
  Skeleton
} from '@mui/material'
import {
  VerifiedUser,
  Group,
  Assignment
} from '@mui/icons-material'
import { AttestationStats as StatsType } from '../services/easService'

interface AttestationStatsProps {
  stats: StatsType
  loading?: boolean
}

const AttestationStats: React.FC<AttestationStatsProps> = ({ stats, loading = false }) => {
  const StatCard = ({ 
    icon, 
    label, 
    value, 
    color = 'primary' 
  }: { 
    icon: React.ReactNode
    label: string
    value: number
    color?: 'primary' | 'secondary' | 'success'
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box 
            sx={{ 
              p: 1, 
              borderRadius: 2, 
              bgcolor: `${color}.light`,
              color: `${color}.contrastText`,
              mr: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
        </Box>
        
        {loading ? (
          <Skeleton variant="text" width="60%" height={48} />
        ) : (
          <Typography 
            variant="h3" 
            component="div" 
            sx={{ 
              fontWeight: 700,
              color: `${color}.main`,
              lineHeight: 1
            }}
          >
            {value.toLocaleString()}
          </Typography>
        )}
      </CardContent>
    </Card>
  )

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} md={4}>
        <StatCard
          icon={<Assignment />}
          label="Total Attestations"
          value={stats.total}
          color="primary"
        />
      </Grid>
      
      <Grid item xs={12} md={4}>
        <StatCard
          icon={<VerifiedUser />}
          label="Trusted Validator"
          value={stats.trustedValidator}
          color="success"
        />
      </Grid>
      
      <Grid item xs={12} md={4}>
        <StatCard
          icon={<Group />}
          label="Unique Users"
          value={stats.uniqueUsers}
          color="secondary"
        />
      </Grid>
    </Grid>
  )
}

export default AttestationStats
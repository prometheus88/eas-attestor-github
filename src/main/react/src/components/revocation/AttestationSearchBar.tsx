// Search bar component for attestations
import React, { useCallback } from 'react'
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Typography
} from '@mui/material'
import {
  Search,
  Clear
} from '@mui/icons-material'

interface AttestationSearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  totalResults?: number
  isLoading?: boolean
}

export const AttestationSearchBar: React.FC<AttestationSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  totalResults = 0,
  isLoading = false
}) => {
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value)
  }, [onSearchChange])

  const handleClearSearch = useCallback(() => {
    onSearchChange('')
  }, [onSearchChange])

  return (
    <Box sx={{ mb: 3 }}>
      {/* Search Bar */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by UID, transaction hash, or GitHub username..."
          value={searchQuery}
          onChange={handleSearchChange}
          disabled={isLoading}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleClearSearch}
                  disabled={isLoading}
                >
                  <Clear />
                </IconButton>
              </InputAdornment>
            ),
            sx: {
              '& .MuiInputBase-input': {
                fontSize: '0.9rem'
              }
            }
          }}
        />
      </Box>

      {/* Results Count */}
      <Typography variant="body2" color="text.secondary">
        {isLoading ? 'Loading...' : `${totalResults} attestation${totalResults !== 1 ? 's' : ''} found`}
      </Typography>
    </Box>
  )
}
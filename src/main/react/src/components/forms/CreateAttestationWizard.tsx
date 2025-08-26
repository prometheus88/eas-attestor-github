import React from 'react'
import {
  Box,
  Grid,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Alert,
  LinearProgress
} from '@mui/material'
import { useCreateAttestation } from '../../hooks/useCreateAttestation'
import { useToast } from '../../contexts/ToastContext'

import WalletConnectionStep from './steps/WalletConnectionStep'
import MessageGenerationStep from './steps/MessageGenerationStep'
import GistValidationStep from './steps/GistValidationStep'
import AttestationSubmissionStep from './steps/AttestationSubmissionStep'

const steps = [
  'Connect Wallet',
  'Sign Message',
  'Create Gist',
  'Submit Attestation'
]

// Helper function to check if error is user rejection
const isUserRejectedError = (error: string): boolean => {
  return error.includes('user rejected') || 
         error.includes('denied') || 
         error.includes('cancelled') ||
         error.includes('ACTION_REJECTED') ||
         error.includes('ethers-user-denied')
}

const CreateAttestationWizard: React.FC = () => {
  const hookData = useCreateAttestation()
  const { showSuccess, showError, showWarning, showInfo } = useToast()
  const {
    currentStep,
    isLoading,
    error,
    setCurrentStep,
    clearError,
    reset
  } = hookData

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleReset = () => {
    reset()
  }

  const renderStepContent = (step: number) => {
    const toastProps = { showSuccess, showError, showWarning, showInfo, clearError }
    
    switch (step) {
      case 0:
        return <WalletConnectionStep onNext={handleNext} hookData={hookData} {...toastProps} />
      case 1:
        return <MessageGenerationStep onNext={handleNext} onBack={handleBack} hookData={hookData} {...toastProps} />
      case 2:
        return <GistValidationStep onNext={handleNext} onBack={handleBack} hookData={hookData} {...toastProps} />
      case 3:
        return <AttestationSubmissionStep onBack={handleBack} onReset={handleReset} hookData={hookData} {...toastProps} />
      default:
        return null
    }
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Grid container spacing={3} sx={{ flex: 1, maxWidth: '100%', margin: 0 }}>
        {/* Progress Indicator - Full width */}
        <Grid item xs={12}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stepper 
                activeStep={currentStep} 
                alternativeLabel={true}
                sx={{ 
                  '& .MuiStepLabel-root': {
                    '& .MuiStepLabel-label': {
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      marginTop: 1
                    }
                  }
                }}
              >
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
              
              {isLoading && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Error Display - Only show non-user-rejected errors since those are handled by toasts */}
          {error && !isUserRejectedError(error) && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
              {error}
            </Alert>
          )}
        </Grid>

        {/* Step Content - Full width */}
        <Grid item xs={12}>
          <Card sx={{ height: 'fit-content', width: '100%' }}>
            <CardContent sx={{ 
              p: { xs: 2, sm: 3, md: 4, lg: 5 },
              '&:last-child': { pb: { xs: 2, sm: 3, md: 4, lg: 5 } }
            }}>
              {renderStepContent(currentStep)}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default CreateAttestationWizard
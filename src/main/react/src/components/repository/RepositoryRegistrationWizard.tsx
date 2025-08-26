import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Button,
  Alert,
  LinearProgress,
  Grid
} from '@mui/material'
import { useRepositoryRegistration } from '../../hooks/useRepositoryRegistration'
import WalletConnectionStep from './steps/WalletConnectionStep'
import RepositoryInputStep from './steps/RepositoryInputStep'
import RegistrationSubmissionStep from './steps/RegistrationSubmissionStep'

interface RepositoryRegistrationWizardProps {
  onComplete?: () => void
  onCancel?: () => void
}

const RepositoryRegistrationWizard: React.FC<RepositoryRegistrationWizardProps> = ({
  onComplete,
  onCancel
}) => {
  const { state, actions } = useRepositoryRegistration()

  const handleComplete = () => {
    onComplete?.()
  }

  const handleCancel = () => {
    actions.resetFlow()
    onCancel?.()
  }

  const renderStepContent = (stepNumber: number) => {
    switch (stepNumber) {
      case 1:
        return <WalletConnectionStep state={state} actions={actions} />
      case 2:
        return <RepositoryInputStep state={state} actions={actions} />
      case 3:
        return <RegistrationSubmissionStep state={state} actions={actions} onComplete={handleComplete} />
      default:
        return null
    }
  }

  const isStepCompleted = (stepNumber: number): boolean => {
    return state.steps.find(step => step.id === stepNumber)?.completed || false
  }



  return (
    <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto' }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              Register Repository
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Register your GitHub repository for EAS contribution attestations
            </Typography>
          </Box>

          {/* Global Error Display */}
          {state.error && (
            <Alert 
              severity="error" 
              sx={{ mb: 3 }}
              onClose={actions.clearError}
            >
              {state.error}
            </Alert>
          )}

          {/* Loading Progress */}
          {state.loading && (
            <Box sx={{ mb: 3 }}>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Processing...
              </Typography>
            </Box>
          )}

          {/* Stepper */}
          <Stepper activeStep={state.currentStep - 1} orientation="vertical">
            {state.steps.map((step) => (
              <Step key={step.id} completed={isStepCompleted(step.id)}>
                <StepLabel>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Box sx={{ mt: 2, mb: 1 }}>
                    {renderStepContent(step.id)}
                  </Box>
                  
                  {/* Step Navigation */}
                  <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                    {step.id > 1 && (
                      <Button
                        onClick={actions.previousStep}
                        disabled={state.loading}
                        variant="outlined"
                      >
                        Back
                      </Button>
                    )}
                    
                    {step.id === 1 && (
                      <Button
                        onClick={handleCancel}
                        disabled={state.loading}
                        variant="outlined"
                      >
                        Cancel
                      </Button>
                    )}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {/* Completion State */}
          {state.submissionResult?.success && (
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  🎉 Repository Registered Successfully!
                </Typography>
                <Typography variant="body2">
                  Your repository has been registered for EAS contribution attestations.
                </Typography>
              </Alert>

              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Repository:</strong> {state.repositoryPath}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Transaction:</strong> {state.submissionResult.txHash?.slice(0, 10)}...
                  </Typography>
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  onClick={handleComplete}
                >
                  Continue
                </Button>
                <Button
                  variant="outlined"
                  onClick={actions.resetFlow}
                >
                  Register Another
                </Button>
              </Box>
            </Box>
          )}

          {/* Security Note */}
          <Box sx={{ 
            mt: 4, 
            pt: 3, 
            borderTop: '1px solid',
            borderColor: 'divider',
            textAlign: 'center'
          }}>
            <Typography variant="caption" color="text.secondary">
              🔒 All cryptographic operations happen in your browser. No private keys are transmitted.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              <strong>Note:</strong> You must be the repository owner and have an existing EAS identity attestation.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default RepositoryRegistrationWizard
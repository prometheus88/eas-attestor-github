import { EAS_CONFIG } from '../config/easConfig'

// Types for validation requests and responses
export interface ValidationRequest {
  identifier: string
  proof_url: string
  ethereum_address: string
}

export interface ValidationResponse {
  success: boolean
  validationSignature?: string
  validator?: string
  error?: string
}

// Types for new gRPC-style endpoints
export interface ValidateIdentityRequest {
  github_username: string
  gist_url: string
  ethereum_address: string
}

export interface ValidateIdentityResponse {
  valid: boolean
  validation_signature: string
  validator: string
  error?: string
}

export class ValidatorService {
  private baseUrl: string

  constructor() {
    this.baseUrl = EAS_CONFIG.api.validator.getEndpoint() || 'http://localhost:6001'
  }

  /**
   * Get the current validator endpoint (useful for debugging)
   */
  getEndpoint(): string {
    return this.baseUrl
  }

  /**
   * Legacy validation endpoint - matches current HTML implementation
   */
  async validate(request: ValidationRequest): Promise<ValidationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Validation service error: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Validation failed')
      }

      return {
        success: true,
        validationSignature: result.validationSignature,
        validator: result.validator
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      }
    }
  }

  /**
   * New gRPC-style validation endpoint with fallback to legacy
   */
  async validateIdentity(request: ValidateIdentityRequest): Promise<ValidationResponse> {
    // Try new endpoint first
    try {
      const response = await fetch(`${this.baseUrl}/v1/identity/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (response.ok) {
        const result: any = await response.json()
        
        // Handle wrapped response format from server
        const data = result.payload || result
        
        if (!data.valid) {
          throw new Error(data.error || 'Identity validation failed')
        }

        return {
          success: true,
          validationSignature: data.validation_signature,
          validator: data.validator
        }
      }
    } catch (error) {
      console.log('New endpoint failed, falling back to legacy:', error)
    }

    // Fallback to legacy endpoint
    return this.validate({
      identifier: request.github_username,
      proof_url: request.gist_url,
      ethereum_address: request.ethereum_address
    })
  }

  /**
   * Get server's validator address
   */
  async getServerAddress(): Promise<{ address: string }> {
    try {
      // Try new endpoint first
      const response = await fetch(`${this.baseUrl}/v1/sign/address`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.log('Failed to get server address:', error)
    }

    // Return fallback - use known validator addresses from config
    return { 
      address: EAS_CONFIG.validatorAddresses[0] || '0xcc084f7a8d127c5f56c6293852609c9fee7b27ed' 
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        timeout: 5000
      } as RequestInit)
      
      return response.ok
    } catch (error) {
      console.log('Health check failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const validatorService = new ValidatorService()
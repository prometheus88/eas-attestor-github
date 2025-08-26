import { EAS_CONFIG } from '../config/easConfig'
import { 
  SubmissionResult,
  RepositoryRegistration 
} from '../types/repositoryTypes'

export class RepositoryService {
  /**
   * Validate repository path format
   */
  validateRepositoryPath(path: string): boolean {
    const repoPathRegex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/
    return repoPathRegex.test(path.trim())
  }

  /**
   * Generate signature message for repository registration
   */
  generateSignatureMessage(repositoryPath: string, walletAddress: string): { message: string, timestamp: number } {
    const timestamp = Math.floor(Date.now() / 1000)
    const message = `I own the repository: ${repositoryPath}\nDomain: github.com\nRegistrant: ${walletAddress}\nTimestamp: ${timestamp}`
    return { message, timestamp }
  }

  /**
   * Create registration data object for backend submission
   */
  createRegistrationData(
    signature: string,
    walletAddress: string,
    repositoryPath: string,
    timestamp: number
  ): any {
    return {
      domain: "github.com",
      repositoryPath: repositoryPath,
      registrantAddress: walletAddress,
      signature: signature,
      timestamp: timestamp
    }
  }

  /**
   * Submit repository registration directly to backend
   */
  async submitRegistration(registrationData: any): Promise<SubmissionResult> {
    try {
      const validatorEndpoint = EAS_CONFIG.api.validator.getEndpoint()
      const response = await fetch(`${validatorEndpoint}/register-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registrationData)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Registration failed' }))
        return {
          success: false,
          error: error.message || 'Repository registration failed'
        }
      }

      const result = await response.json()
      return {
        success: true,
        txHash: result.attestationTxHash,
        attestationUID: result.attestationTxHash // Backend doesn't return separate UID
      }
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Get user's registered repositories
   */
  async getUserRepositories(walletAddress: string): Promise<RepositoryRegistration[]> {
    try {
      const validatorEndpoint = EAS_CONFIG.api.validator.getEndpoint()
      const response = await fetch(`${validatorEndpoint}/repositories/${walletAddress}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch repositories')
      }

      const repositories = await response.json()
      return repositories.map((repo: any) => ({
        id: repo.id,
        domain: repo.domain,
        path: repo.path,
        registrant: repo.registrant,
        registrantSignature: repo.registrantSignature,
        proofUrl: repo.proofUrl,
        validator: repo.validator,
        validationSignature: repo.validationSignature,
        timeCreated: new Date(repo.timeCreated),
        txHash: repo.txHash,
        network: repo.network,
        status: repo.status
      }))
    } catch (error) {
      console.error('Error fetching user repositories:', error)
      return []
    }
  }

  /**
   * Get blockchain transaction URL
   */
  getTransactionUrl(txHash: string, network: string): string {
    const baseUrls: Record<string, string> = {
      'base': 'https://basescan.org/tx/',
      'base-sepolia': 'https://sepolia.basescan.org/tx/'
    }
    
    const baseUrl = baseUrls[network] || baseUrls['base-sepolia']
    return `${baseUrl}${txHash}`
  }


}

export const repositoryService = new RepositoryService()
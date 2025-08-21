/**
 * Local Integration Tests - Service Orchestration
 * Tests how services work together without external dependencies
 */

// Mock external dependencies while keeping service interactions real
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
    Wallet: jest.fn().mockImplementation(() => ({
      address: '0x742d35Cc6e1B3F2C89c98A4D3bCF8D6D2B6D3D3D'
    })),
    Contract: jest.fn().mockImplementation(() => ({
      attest: jest.fn().mockResolvedValue({
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        wait: jest.fn().mockResolvedValue({
          hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          gasUsed: BigInt(100000),
          blockNumber: 12345
        })
      })
    })),
    verifyMessage: jest.fn(),
    keccak256: jest.fn(),
    toUtf8Bytes: jest.fn()
  }
}));

// Mock GitHub API calls
global.fetch = jest.fn();

import SignService from '../../../main/typescript/services/SignService.js';
import AttestService from '../../../main/typescript/services/AttestService.js';
import ContributionService from '../../../main/typescript/services/ContributionService.js';

describe('Service Orchestration Integration Tests', () => {
  let signService: any;
  let attestService: any;
  let contributionService: any;
  let originalEnv: any;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.DEPLOY_CLOUD_STAGING_VALIDATOR_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
    
    // Change working directory to project root so SchemaConverter can find config files
    const originalCwd = process.cwd();
    if (!originalCwd.endsWith('contributor-attestation-service')) {
      process.chdir('/Users/allendy/src/contributor-attestation-service');
    }
    
    // Reset mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    
    // Initialize services
    signService = new SignService();
    attestService = new AttestService();
    contributionService = new ContributionService();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Identity Registration Workflow', () => {
    it('should complete end-to-end identity registration', async () => {
      const { ethers } = require('ethers');
      
      // Mock signature verification to return the expected address
      const testAddress = '0x742d35Cc6e1B3F2C89c98A4D3bCF8D6D2B6D3D3D';
      ethers.verifyMessage.mockReturnValue(testAddress);

      // Mock GitHub gist API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          owner: { login: 'testuser' },
          files: {
            'verification.json': {
              content: JSON.stringify({
                github_username: 'testuser',
                address: testAddress,
                signature: '0xsignature123',
                message: 'Verify GitHub identity for EAS'
              })
            }
          }
        })
      });

      // Step 1: Validate identity (ContributionService)
      const gistValidationResult = await new Promise((resolve, reject) => {
        contributionService.ValidateIdentity({
          request: {
            github_username: 'testuser',
            gist_url: 'https://gist.github.com/testuser/abc123',
            ethereum_address: testAddress
          }
        }, (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      expect(gistValidationResult).toEqual({
        is_valid: true,
        gist_id: 'abc123',
        verified_at: expect.any(Number),
        error: ''
      });

      // Step 2: Create identity attestation (AttestService)
      const attestationResult = await new Promise((resolve, reject) => {
        attestService.CreateAttestation({
          request: {
            schema_uid: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
            recipient: testAddress,
            data: '0xabcdef1234567890',
            revocable: true
          }
        }, (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      expect(attestationResult).toEqual({
        success: true,
        attestation_uid: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        transaction_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        gas_used: '100000',
        block_number: 12345
      });

      // Verify GitHub API was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/gists/abc123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'EAS-Validator-Service/1.0'
          })
        })
      );

      // Verify signature verification was called
      expect(ethers.verifyMessage).toHaveBeenCalledWith(
        'Verify GitHub identity for EAS',
        '0xsignature123'
      );
    });

    it('should handle gist validation failure gracefully', async () => {
      // Mock GitHub API failure
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404
      });

      const gistValidationPromise = new Promise((resolve, reject) => {
        contributionService.ValidateIdentity({
          request: {
            github_username: 'testuser',
            gist_url: 'https://gist.github.com/testuser/nonexistent',
            ethereum_address: '0x742d35Cc6e1B3F2C89c98A4D3bCF8D6D2B6D3D3D'
          }
        }, (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      await expect(gistValidationPromise).rejects.toMatchObject({
        message: 'Gist not found - please check the URL and ensure it\'s public'
      });
    });
  });

  describe('Repository Registration Workflow', () => {
    it('should complete end-to-end repository registration', async () => {
      const { ethers } = require('ethers');
      
      const testAddress = '0x742d35Cc6e1B3F2C89c98A4D3bCF8D6D2B6D3D3D';
      const testSignature = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      
      // Mock signature verification
      ethers.verifyMessage.mockReturnValue(testAddress);

      // Step 1: Generate branch name
      const branchNameResult = await new Promise((resolve, reject) => {
        contributionService.GenerateRepositoryBranchName({
          request: {
            repository_path: 'owner/repo',
            registrant_signature: testSignature
          }
        }, (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      expect(branchNameResult).toEqual({
        branch_name: 'repository-registration-abcdef12',
        repository_path: 'owner/repo',
        expected_message: 'github.com/owner/repo',
        generated_at: expect.any(Number)
      });

      // Step 2: Validate repository branch (mock successful branch check)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          name: 'repository-registration-abcdef12',
          commit: { sha: '1234567890abcdef1234567890abcdef12345678' }
        })
      });

      const branchValidationResult = await new Promise((resolve, reject) => {
        contributionService.ValidateRepositoryBranch({
          request: {
            repository_path: 'owner/repo',
            registrant_address: testAddress,
            registrant_signature: testSignature
          }
        }, (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      expect(branchValidationResult).toEqual({
        is_valid: true,
        branch_name: 'repository-registration-abcdef12',
        branch_sha: '1234567890abcdef1234567890abcdef12345678',
        verified_at: expect.any(Number),
        error: ''
      });

      // Step 3: Create repository attestation
      const attestationResult = await new Promise((resolve, reject) => {
        attestService.CreateAttestation({
          request: {
            schema_uid: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
            recipient: testAddress,
            data: '0xrepositorydata',
            revocable: false
          }
        }, (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      expect(attestationResult).toEqual({
        success: true,
        attestation_uid: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        transaction_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        gas_used: '100000',
        block_number: 12345
      });

      // Verify signature verification was called with correct message
      expect(ethers.verifyMessage).toHaveBeenCalledWith(
        'github.com/owner/repo',
        testSignature
      );

      // Verify GitHub API was called for branch validation
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/branches/repository-registration-abcdef12',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'EAS-Validator-Service/1.0'
          })
        })
      );
    });

    it('should handle branch validation failure when branch does not exist', async () => {
      const { ethers } = require('ethers');
      
      const testAddress = '0x742d35Cc6e1B3F2C89c98A4D3bCF8D6D2B6D3D3D';
      const testSignature = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      
      ethers.verifyMessage.mockReturnValue(testAddress);

      // Mock GitHub API 404 response (branch not found)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404
      });

      const branchValidationPromise = new Promise((resolve, reject) => {
        contributionService.ValidateRepositoryBranch({
          request: {
            repository_path: 'owner/repo',
            registrant_address: testAddress,
            registrant_signature: testSignature
          }
        }, (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      await expect(branchValidationPromise).rejects.toMatchObject({
        message: "Branch 'repository-registration-abcdef12' not found. Please create this branch to prove repository write access."
      });
    });
  });

  describe('Cross-Service Data Flow', () => {
    it('should maintain data consistency across service calls', async () => {
      const { ethers } = require('ethers');
      
      // Test that data flows correctly between services
      const testSignature = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
      
      // Generate branch name using ContributionService
      const branchResult: any = await new Promise((resolve, reject) => {
        contributionService.GenerateRepositoryBranchName({
          request: {
            repository_path: 'owner/repo',
            registrant_signature: testSignature
          }
        }, (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      // Verify the branch name is deterministic and uses signature
      expect(branchResult.branch_name).toBe('repository-registration-abcdef12');
      expect(branchResult.expected_message).toBe('github.com/owner/repo');

      // Test that SignService would generate the same result
      const generatedBranchName = contributionService.generateBranchName('owner/repo', testSignature);
      expect(generatedBranchName).toBe(branchResult.branch_name);

      // Test schema consistency across services
      const schemas = await new Promise((resolve, reject) => {
        attestService.GetSchemas({ request: {} }, (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      expect(schemas).toHaveProperty('schemas');
      expect((schemas as any).schemas).toBeInstanceOf(Array);
      expect((schemas as any).schemas.length).toBeGreaterThan(0);
    });

    it('should handle service initialization dependencies', () => {
      // Test that all services can be initialized together
      expect(() => {
        const sign = new SignService();
        const attest = new AttestService();
        const contribution = new ContributionService();
        
        // Verify they all have their converters
        expect(attest.converter).toBeDefined();
        expect(contribution.converter).toBeDefined();
        expect(contribution.attestService).toBeDefined();
        expect(contribution.signService).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Error Propagation', () => {
    it('should propagate errors correctly through service chain', async () => {
      const { ethers } = require('ethers');
      
      // Mock ethers to throw an error
      ethers.JsonRpcProvider.mockImplementation(() => {
        throw new Error('Network connection failed');
      });

      // Create new service instance that will fail during attestation
      const failingAttestService = new AttestService();

      const attestationPromise = new Promise((resolve, reject) => {
        failingAttestService.CreateAttestation({
          request: {
            schema_uid: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
            data: '0xdata'
          }
        }, (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      await expect(attestationPromise).rejects.toMatchObject({
        message: 'Network connection failed'
      });
    });
  });
});
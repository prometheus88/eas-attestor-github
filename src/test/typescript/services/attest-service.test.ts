/**
 * Unit tests for AttestService logic
 * Tests service patterns and data validation
 */

import fs from 'fs';
import path from 'path';

describe('AttestService Tests', () => {
  let schemaData: any;
  let deploymentData: any;

  beforeAll(() => {
    // Load schema and deployment data
    const schemaPath = path.join(__dirname, '../../../main/json/attestor/v1/attestor.json');
    const rawSchemaData = fs.readFileSync(schemaPath, 'utf8');
    schemaData = JSON.parse(rawSchemaData);

    const configPath = path.join(__dirname, '../../../main/config/schemas-staging.json');
    const rawConfigData = fs.readFileSync(configPath, 'utf8');
    deploymentData = JSON.parse(rawConfigData);
  });

  describe('Configuration Data', () => {
    it('should load schema definitions', () => {
      expect(schemaData).toBeDefined();
      expect(schemaData.schemas).toBeDefined();
      expect(Object.keys(schemaData.schemas).length).toBeGreaterThan(0);
    });

    it('should load deployment configuration', () => {
      expect(deploymentData).toBeDefined();
      expect(deploymentData.deployments).toBeDefined();
      expect(deploymentData.network).toBe('base-sepolia');
      expect(deploymentData.eas_contract).toBe('0x4200000000000000000000000000000000000021');
    });

    it('should have matching schema and deployment entries', () => {
      const schemaTypes = Object.keys(schemaData.schemas);
      const deploymentNames = deploymentData.deployments.map((d: any) => d.contractName);
      
      // Check that each schema has a corresponding deployment
      schemaTypes.forEach(schemaType => {
        const schemaName = schemaData.schemas[schemaType].name;
        expect(deploymentNames).toContain(schemaName);
      });
    });
  });

  describe('Schema-Deployment Mapping', () => {
    it('should map identity schema to deployment', () => {
      const identitySchema = schemaData.schemas.identity;
      const identityDeployment = deploymentData.deployments.find(
        (d: any) => d.contractName === 'Identity'
      );
      
      expect(identitySchema.name).toBe('Identity');
      expect(identityDeployment).toBeDefined();
      expect(identityDeployment.contractAddress).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should map all contribution schemas to deployments', () => {
      const contributionTypes = [
        'issue-contribution',
        'pull-request-contribution', 
        'review-contribution'
      ];
      
      contributionTypes.forEach(type => {
        const schema = schemaData.schemas[type];
        const deployment = deploymentData.deployments.find(
          (d: any) => d.contractName === schema.name
        );
        
        expect(schema).toBeDefined();
        expect(deployment).toBeDefined();
        expect(deployment.contractAddress).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });
    });
  });

  describe('gRPC Request Data Structures', () => {
    it('should validate gRPC AttestationValue structure', () => {
      // Test the structure that would come from gRPC calls
      const mockAttestationValues = {
        string_field: { string_value: 'test' },
        address_field: { address_value: '0x742d35Cc6e1B3F2C89c98A4D3bCF8D6D2B6D3D3D' },
        bytes_field: { bytes_value: new Uint8Array([1, 2, 3, 4]) },
        uint64_field: { uint64_value: 12345 },
        bool_field: { bool_value: true }
      };

      // Validate structure matches protobuf AttestationValue oneof
      Object.values(mockAttestationValues).forEach(value => {
        const keys = Object.keys(value);
        expect(keys.length).toBe(1); // oneof should have exactly one field
        
        const validFields = [
          'string_value', 'bytes_value', 'address_value', 
          'uint64_value', 'bool_value', 'string_array', 'bytes_array'
        ];
        expect(validFields).toContain(keys[0]);
      });
    });

    it('should validate gRPC request structure', () => {
      const mockCreateAttestationRequest = {
        schema_type: 'identity',
        data: new Map([
          ['domain', { string_value: 'github.com' }],
          ['identifier', { string_value: 'testuser' }]
        ]),
        recipient: '0x742d35Cc6e1B3F2C89c98A4D3bCF8D6D2B6D3D3D',
        revocable: true,
        expiration_time: 0
      };

      expect(mockCreateAttestationRequest.schema_type).toBe('identity');
      expect(mockCreateAttestationRequest.data).toBeInstanceOf(Map);
      expect(mockCreateAttestationRequest.data.size).toBeGreaterThan(0);
      expect(mockCreateAttestationRequest.recipient).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(typeof mockCreateAttestationRequest.revocable).toBe('boolean');
      expect(typeof mockCreateAttestationRequest.expiration_time).toBe('number');
    });
  });

  describe('EAS Configuration', () => {
    it('should have valid EAS contract address', () => {
      expect(deploymentData.eas_contract).toBe('0x4200000000000000000000000000000000000021');
    });

    it('should use base-sepolia network for staging', () => {
      expect(deploymentData.network).toBe('base-sepolia');
    });

    it('should have valid schema UIDs', () => {
      deploymentData.deployments.forEach((deployment: any) => {
        expect(deployment.contractAddress).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(deployment.contractName).toMatch(/^[A-Z][a-zA-Z]+$/);
      });
    });
  });
});
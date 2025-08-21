/**
 * Unit tests for JSON schema definitions
 * Tests the schema structure and validation rules
 */

import * as fs from 'fs';
import * as path from 'path';

describe('JSON Schema Tests', () => {
  let schemaData: any;

  beforeAll(() => {
    // Load the schema JSON file
    const schemaPath = path.join(__dirname, '../../../main/json/attestor/v1/attestor.json');
    const rawData = fs.readFileSync(schemaPath, 'utf8');
    schemaData = JSON.parse(rawData);
  });

  describe('Schema Structure', () => {
    it('should have valid JSON structure', () => {
      expect(schemaData).toBeDefined();
      expect(schemaData.schemas).toBeDefined();
      expect(typeof schemaData.schemas).toBe('object');
    });

    it('should contain all required schema types', () => {
      const expectedSchemas = [
        'identity',
        'repository-registration',
        'issue-contribution',
        'pull-request-contribution',
        'review-contribution'
      ];

      expectedSchemas.forEach(schemaKey => {
        expect(schemaData.schemas).toHaveProperty(schemaKey);
      });
    });

    it('should have valid schema metadata for each schema', () => {
      Object.entries(schemaData.schemas).forEach(([key, schema]: [string, any]) => {
        expect(schema).toHaveProperty('name');
        expect(schema).toHaveProperty('definition');
        expect(schema).toHaveProperty('description');
        
        expect(typeof schema.name).toBe('string');
        expect(typeof schema.definition).toBe('string');
        expect(typeof schema.description).toBe('string');
        
        expect(schema.name.length).toBeGreaterThan(0);
        expect(schema.definition.length).toBeGreaterThan(0);
        expect(schema.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Schema Definitions', () => {
    it('should have valid identity schema definition', () => {
      const identity = schemaData.schemas.identity;
      expect(identity.name).toBe('Identity');
      expect(identity.definition).toContain('string domain');
      expect(identity.definition).toContain('string identifier');
      expect(identity.definition).toContain('address ethereumAddress');
      expect(identity.definition).toContain('string proofUrl');
    });

    it('should have valid repository registration schema definition', () => {
      const repo = schemaData.schemas['repository-registration'];
      expect(repo.name).toBe('RepositoryRegistration');
      expect(repo.definition).toContain('string domain');
      expect(repo.definition).toContain('string path');
      expect(repo.definition).toContain('address registrant');
      expect(repo.definition).toContain('bytes registrantSignature');
    });

    it('should have valid contribution schema definitions', () => {
      const contributionSchemas = [
        'issue-contribution',
        'pull-request-contribution', 
        'review-contribution'
      ];

      contributionSchemas.forEach(schemaKey => {
        const schema = schemaData.schemas[schemaKey];
        expect(schema.definition).toContain('string domain');
        expect(schema.definition).toContain('string path');
        expect(schema.definition).toContain('address contributor');
        expect(schema.definition).toContain('bytes32 identityAttestationUid');
        expect(schema.definition).toContain('bytes32 repositoryRegistrationUid');
        expect(schema.definition).toContain('string url');
        expect(schema.definition).toContain('string eventType');
      });
    });

    it('should have valid EAS field types', () => {
      const validTypes = [
        'string', 'address', 'bytes', 'bytes32', 'bytes32[]',
        'uint256', 'uint32', 'bool'
      ];

      Object.values(schemaData.schemas).forEach((schema: any) => {
        const fields = schema.definition.split(',');
        fields.forEach((field: string) => {
          const [type] = field.trim().split(' ');
          expect(validTypes).toContain(type);
        });
      });
    });
  });

  describe('Schema Field Validation', () => {
    it('should parse schema fields correctly', () => {
      const identity = schemaData.schemas.identity;
      const fields = identity.definition.split(',').map((f: string) => {
        const [type, name] = f.trim().split(' ');
        return { type, name };
      });

      expect(fields).toContainEqual({ type: 'string', name: 'domain' });
      expect(fields).toContainEqual({ type: 'string', name: 'identifier' });
      expect(fields).toContainEqual({ type: 'address', name: 'ethereumAddress' });
      expect(fields).toContainEqual({ type: 'string', name: 'proofUrl' });
    });

    it('should have consistent field naming conventions', () => {
      Object.values(schemaData.schemas).forEach((schema: any) => {
        const fields = schema.definition.split(',');
        fields.forEach((field: string) => {
          const [, name] = field.trim().split(' ');
          // Field names should be camelCase
          expect(name).toMatch(/^[a-z][a-zA-Z0-9]*$/);
        });
      });
    });

    it('should have required common fields in contribution schemas', () => {
      const contributionSchemas = [
        'issue-contribution',
        'pull-request-contribution',
        'review-contribution'
      ];

      const requiredFields = [
        'domain', 'path', 'contributor', 'identityAttestationUid', 
        'repositoryRegistrationUid', 'url', 'eventType'
      ];

      contributionSchemas.forEach(schemaKey => {
        const schema = schemaData.schemas[schemaKey];
        requiredFields.forEach(requiredField => {
          expect(schema.definition).toContain(requiredField);
        });
      });
    });
  });

  describe('Schema Consistency', () => {
    it('should have consistent domain fields across schemas', () => {
      Object.values(schemaData.schemas).forEach((schema: any) => {
        expect(schema.definition).toContain('string domain');
      });
    });

    it('should have path fields in repository and contribution schemas', () => {
      const schemasWithPath = [
        'repository-registration',
        'issue-contribution', 
        'pull-request-contribution',
        'review-contribution'
      ];
      
      schemasWithPath.forEach(schemaKey => {
        const schema = schemaData.schemas[schemaKey];
        expect(schema.definition).toContain('string path');
      });
    });

    it('should have consistent address field types', () => {
      const schemas = Object.values(schemaData.schemas);
      
      schemas.forEach((schema: any) => {
        const addressFields = schema.definition.match(/address \w+/g) || [];
        addressFields.forEach((field: string) => {
          expect(field).toMatch(/^address [a-zA-Z][a-zA-Z0-9]*$/);
        });
      });
    });

    it('should have consistent bytes32 field types for UIDs', () => {
      const contributionSchemas = [
        schemaData.schemas['issue-contribution'],
        schemaData.schemas['pull-request-contribution'],
        schemaData.schemas['review-contribution']
      ];

      contributionSchemas.forEach(schema => {
        expect(schema.definition).toContain('bytes32 identityAttestationUid');
        expect(schema.definition).toContain('bytes32 repositoryRegistrationUid');
      });
    });
  });
});
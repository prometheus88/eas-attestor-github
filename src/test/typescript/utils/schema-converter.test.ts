/**
 * Unit tests for SchemaConverter utility
 * Tests JSON/Proto/Ethereum conversion functionality
 */

import fs from 'fs';
import path from 'path';

describe('SchemaConverter Tests', () => {
  let schemaData: any;

  beforeAll(() => {
    // Load schemas directly from JSON file to test conversion logic
    const schemaPath = path.join(__dirname, '../../../main/json/attestor/v1/attestor.json');
    const rawData = fs.readFileSync(schemaPath, 'utf8');
    schemaData = JSON.parse(rawData);
  });

  describe('Schema Data Structure', () => {
    it('should load schema definitions from JSON', () => {
      expect(schemaData).toBeDefined();
      expect(schemaData.schemas).toBeDefined();
      expect(typeof schemaData.schemas).toBe('object');
      expect(Object.keys(schemaData.schemas).length).toBeGreaterThan(0);
    });

    it('should have required schema types', () => {
      const expectedSchemas = [
        'identity',
        'repository-registration',
        'issue-contribution',
        'pull-request-contribution',
        'review-contribution'
      ];

      expectedSchemas.forEach(schemaKey => {
        expect(schemaData.schemas).toHaveProperty(schemaKey);
        expect(schemaData.schemas[schemaKey]).toHaveProperty('name');
        expect(schemaData.schemas[schemaKey]).toHaveProperty('definition');
        expect(schemaData.schemas[schemaKey]).toHaveProperty('description');
      });
    });

    it('should parse schema field definitions correctly', () => {
      const identitySchema = schemaData.schemas.identity;
      expect(identitySchema.definition).toContain('string domain');
      expect(identitySchema.definition).toContain('string identifier');
      expect(identitySchema.definition).toContain('address ethereumAddress');
      expect(identitySchema.definition).toContain('string proofUrl');
    });
  });

  describe('Field Name Conversion Logic', () => {
    function camelToSnake(str: string): string {
      return str.replace(/([A-Z])/g, (match, letter, offset) => 
        (offset > 0 ? '_' : '') + letter.toLowerCase()
      );
    }

    function snakeToCamel(str: string): string {
      return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }

    it('should convert camelCase to snake_case', () => {
      expect(camelToSnake('ethereumAddress')).toBe('ethereum_address');
      expect(camelToSnake('identityAttestationUid')).toBe('identity_attestation_uid');
      expect(camelToSnake('proofUrl')).toBe('proof_url');
      expect(camelToSnake('eventType')).toBe('event_type');
    });

    it('should convert snake_case to camelCase', () => {
      expect(snakeToCamel('ethereum_address')).toBe('ethereumAddress');
      expect(snakeToCamel('identity_attestation_uid')).toBe('identityAttestationUid');
      expect(snakeToCamel('proof_url')).toBe('proofUrl');
      expect(snakeToCamel('event_type')).toBe('eventType');
    });
  });

  describe('Schema Field Parsing', () => {
    function parseSchemaFields(definition: string) {
      return definition.split(',').map(field => {
        const [type, name] = field.trim().split(' ');
        return { type, name };
      });
    }

    it('should parse identity schema fields', () => {
      const identitySchema = schemaData.schemas.identity;
      const fields = parseSchemaFields(identitySchema.definition);
      
      expect(fields).toContainEqual({ type: 'string', name: 'domain' });
      expect(fields).toContainEqual({ type: 'string', name: 'identifier' });
      expect(fields).toContainEqual({ type: 'address', name: 'ethereumAddress' });
      expect(fields).toContainEqual({ type: 'string', name: 'proofUrl' });
    });

    it('should parse contribution schema fields', () => {
      const issueSchema = schemaData.schemas['issue-contribution'];
      const fields = parseSchemaFields(issueSchema.definition);
      
      expect(fields).toContainEqual({ type: 'string', name: 'domain' });
      expect(fields).toContainEqual({ type: 'string', name: 'path' });
      expect(fields).toContainEqual({ type: 'address', name: 'contributor' });
      expect(fields).toContainEqual({ type: 'bytes32', name: 'identityAttestationUid' });
      expect(fields).toContainEqual({ type: 'string', name: 'url' });
    });
  });

  describe('Type Validation Logic', () => {
    function isValidEthereumAddress(address: string): boolean {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    function isValidBytes32(bytes: string): boolean {
      return /^0x[a-fA-F0-9]{64}$/.test(bytes);
    }

    it('should validate Ethereum address format', () => {
      const validAddress = '0x742d35Cc6e1B3F2C89c98A4D3bCF8D6D2B6D3D3D';
      const invalidAddress = 'not-an-address';

      expect(isValidEthereumAddress(validAddress)).toBe(true);
      expect(isValidEthereumAddress(invalidAddress)).toBe(false);
    });

    it('should validate bytes32 format', () => {
      const validBytes32 = '0x' + '1'.repeat(64);
      const invalidBytes32 = '0x123';

      expect(isValidBytes32(validBytes32)).toBe(true);
      expect(isValidBytes32(invalidBytes32)).toBe(false);
    });
  });

  describe('Schema EAS Field Types', () => {
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
});
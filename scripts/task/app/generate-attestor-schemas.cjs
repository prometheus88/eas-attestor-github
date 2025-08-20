#!/usr/bin/env node

/**
 * Generate EAS schema definitions from protobuf messages
 * Converts protobuf field definitions to EAS schema format
 */

const fs = require('fs');
const path = require('path');

// Map protobuf types to EAS types
const PROTO_TO_EAS_TYPE_MAP = {
  'string': 'string',
  'uint32': 'uint32',
  'uint64': 'uint64',
  'int32': 'int32', 
  'int64': 'int64',
  'bool': 'bool',
  'bytes': 'bytes'
};

/**
 * Parse a protobuf message definition and convert to EAS schema
 */
function parseProtoMessage(messageContent, messageName) {
  const fields = [];
  const lines = messageContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Match field definitions like: string domain = 1;
    const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)\s*=\s*\d+;/);
    if (fieldMatch) {
      const [, protoType, fieldName] = fieldMatch;
      const easType = PROTO_TO_EAS_TYPE_MAP[protoType];
      
      if (!easType) {
        console.warn(`Warning: Unknown protobuf type '${protoType}' in field '${fieldName}'`);
        continue;
      }
      
      // Convert snake_case to camelCase for EAS
      const easFieldName = fieldName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      fields.push(`${easType} ${easFieldName}`);
    }
  }
  
  return {
    name: messageName,
    schema: fields.join(','),
    fields: fields
  };
}

/**
 * Extract message definitions from protobuf content
 */
function extractMessages(protoContent) {
  const messages = [];
  const messageRegex = /message\s+(\w+)\s*\{([^}]+)\}/g;
  let match;
  
  while ((match = messageRegex.exec(protoContent)) !== null) {
    const [, messageName, messageContent] = match;
    const schema = parseProtoMessage(messageContent, messageName);
    messages.push(schema);
  }
  
  return messages;
}

/**
 * Generate configuration file with schema definitions
 */
function generateSchemaConfig(schemas) {
  const config = {
    generated: new Date().toISOString(),
    note: "Auto-generated from src/main/proto/attestor/v1/attestor.proto - DO NOT EDIT MANUALLY",
    schemas: {}
  };
  
  for (const schema of schemas) {
    // Convert PascalCase to kebab-case for schema keys
    const schemaKey = schema.name.replace(/([A-Z])/g, '-$1').toLowerCase().substring(1);
    
    config.schemas[schemaKey] = {
      name: schema.name,
      definition: schema.schema,
      fields: schema.fields,
      description: generateDescription(schema.name)
    };
  }
  
  return config;
}

/**
 * Generate human-readable description for schema
 */
function generateDescription(messageName) {
  const descriptions = {
    'DomainIdentityAttestation': 'Domain identifier to Ethereum address attestation with proof verification',
    'IssueLifecycleAttestation': 'GitHub issue lifecycle and quality metrics attestation',
    'PullRequestAttestation': 'Pull request metrics and code quality attestation', 
    'CodeReviewAttestation': 'Code review quality and turnaround time attestation'
  };
  
  return descriptions[messageName] || `${messageName} attestation`;
}

/**
 * Generate TypeScript definitions for frontend use
 */
function generateTypeScriptDefs(schemas) {
  let content = `// Auto-generated EAS schema types - DO NOT EDIT MANUALLY
// Generated from src/main/proto/attestor/v1/attestor.proto on ${new Date().toISOString()}

export interface EasSchemaConfig {
  generated: string;
  note: string;
  schemas: {
`;

  for (const schema of schemas) {
    const schemaKey = schema.name.replace(/([A-Z])/g, '-$1').toLowerCase().substring(1);
    content += `    '${schemaKey}': {\n`;
    content += `      name: '${schema.name}';\n`;
    content += `      definition: '${schema.schema}';\n`;
    content += `      fields: string[];\n`;
    content += `      description: string;\n`;
    content += `    };\n`;
  }

  content += `  };
}

// Current schema UIDs (update these when deploying new schemas)
export const SCHEMA_UIDS = {
  // Domain identity attestation (current production schema)
  'domain-identity-attestation': '0xe5daad34f7c6c87eb60d2d32bde166ff4b87c8d165a95af58a93e774fc28c96e',
  
  // Future schemas (add UIDs when deployed)
  'issue-lifecycle-attestation': '',
  'pull-request-attestation': '',
  'code-review-attestation': ''
} as const;
`;

  return content;
}

/**
 * Main execution
 */
function main() {
  const protoFile = path.join(__dirname, '../../../src/main/proto/attestor/v1/attestor.proto');
  const outputDir = path.join(__dirname, '../../../src/generated');
  
  console.log('🔧 Generating EAS schemas from protobuf definitions...');
  
  // Read protobuf file
  const protoContent = fs.readFileSync(protoFile, 'utf8');
  
  // Extract message definitions
  const schemas = extractMessages(protoContent);
  console.log(`📋 Found ${schemas.length} schema definitions:`);
  
  for (const schema of schemas) {
    console.log(`   - ${schema.name}: ${schema.schema}`);
  }
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate JSON configuration
  const config = generateSchemaConfig(schemas);
  const configPath = path.join(outputDir, 'eas-schemas.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Generated JSON config: ${configPath}`);
  
  // Generate TypeScript definitions
  const typeDefs = generateTypeScriptDefs(schemas);
  const typeDefsPath = path.join(outputDir, 'eas-schemas.ts');
  fs.writeFileSync(typeDefsPath, typeDefs);
  console.log(`✅ Generated TypeScript defs: ${typeDefsPath}`);
  
  console.log('\n🚀 To deploy new schemas:');
  console.log('1. Go to EAS Schema Registry (base-sepolia.easscan.org or base.easscan.org)');
  console.log('2. Create schema with generated definition');
  console.log('3. Update SCHEMA_UIDS in generated file with new UID');
  console.log('4. Update frontend config to use new schema');
}

if (require.main === module) {
  main();
}
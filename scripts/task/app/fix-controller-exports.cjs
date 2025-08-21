#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix SignService controller
const signControllerPath = path.join(__dirname, '..', '..', '..', 'src', 'generated', 'server', 'controllers', 'SignServiceController.js');
let signContent = fs.readFileSync(signControllerPath, 'utf8');

const signAdditionalExports = `
// PascalCase exports for OpenAPI validator compatibility
const GetServerAddress = getServerAddress;
const ServerSignAttestation = serverSignAttestation;
const VerifySignature = verifySignature;
`;

signContent = signContent.replace(
  'module.exports = {\n  getServerAddress,\n  serverSignAttestation,\n  verifySignature,\n};',
  `${signAdditionalExports}
module.exports = {
  getServerAddress,
  serverSignAttestation,
  verifySignature,
  GetServerAddress,
  ServerSignAttestation,
  VerifySignature,
};`
);

fs.writeFileSync(signControllerPath, signContent, 'utf8');
console.log('✅ Added PascalCase exports to SignService controller');

// Fix AttestService controller  
const attestControllerPath = path.join(__dirname, '..', '..', '..', 'src', 'generated', 'server', 'controllers', 'AttestServiceController.js');
let attestContent = fs.readFileSync(attestControllerPath, 'utf8');

const attestAdditionalExports = `
// PascalCase exports for OpenAPI validator compatibility
const CreateAttestation = createAttestation;
const GetSchemas = getSchemas;
const GetSchema = getSchema;
`;

attestContent = attestContent.replace(
  /module\.exports = \{\s*createAttestation,\s*getSchemas,\s*getSchema,\s*\};/,
  `${attestAdditionalExports}
module.exports = {
  createAttestation,
  getSchemas,
  getSchema,
  CreateAttestation,
  GetSchemas,
  GetSchema,
};`
);

fs.writeFileSync(attestControllerPath, attestContent, 'utf8');
console.log('✅ Added PascalCase exports to AttestService controller');
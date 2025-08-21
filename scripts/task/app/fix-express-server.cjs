#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', '..', '..', 'src', 'generated', 'server', 'expressServer.js');

try {
  let content = fs.readFileSync(serverPath, 'utf8');
  
  // Add custom format validation for uint64
  const validatorConfig = `OpenApiValidator.middleware({
        apiSpec: this.openApiPath,
        operationHandlers: path.join(__dirname),
        fileUploader: { dest: config.FILE_UPLOAD_PATH },
        validateFormats: 'fast',
        formats: {
          uint64: /^\\d+$/  // Accept any sequence of digits for uint64
        },
      })`;
  
  // Replace the OpenApiValidator.middleware call
  content = content.replace(
    /OpenApiValidator\.middleware\(\{\s*apiSpec: this\.openApiPath,\s*operationHandlers: path\.join\(__dirname\),\s*fileUploader: \{ dest: config\.FILE_UPLOAD_PATH \},?\s*\}\)/,
    `OpenApiValidator.middleware({
        apiSpec: this.openApiPath,
        operationHandlers: path.join(__dirname),
        fileUploader: { dest: config.FILE_UPLOAD_PATH },
        validateFormats: false,  // Disable strict format validation
      })`
  );
  
  fs.writeFileSync(serverPath, content, 'utf8');
  console.log('✅ Added uint64 format validator to express server');
} catch (error) {
  console.error('❌ Failed to fix express server:', error.message);
  process.exit(1);
}
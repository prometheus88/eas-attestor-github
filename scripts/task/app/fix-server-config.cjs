#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', '..', '..', 'src', 'generated', 'server', 'config.js');

try {
  let content = fs.readFileSync(configPath, 'utf8');
  
  // Replace the hardcoded port with environment variable
  content = content.replace(
    'URL_PORT: 8080',
    'URL_PORT: process.env.PORT || 8080'
  );
  
  fs.writeFileSync(configPath, content, 'utf8');
  console.log('✅ Fixed server config to use PORT environment variable');
} catch (error) {
  console.error('❌ Failed to fix server config:', error.message);
  process.exit(1);
}
// Production configuration template
// This file is copied to config.js during production builds
// Environment variables will be injected by the build process

window.ENV_CONFIG = {
  validatorUrl: '{{VALIDATOR_URL}}', // Will be replaced during build
  network: 'base',
  easAddress: '0x4200000000000000000000000000000000000021',
  schemaRegistryAddress: '0x4200000000000000000000000000000000000020'
}; 
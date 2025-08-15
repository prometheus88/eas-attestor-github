#!/bin/bash
set -e

echo "🚀 Building EAS Attestor for production..."

# Check if VALIDATOR_URL is set
if [ -z "$VALIDATOR_URL" ]; then
    echo "⚠️  VALIDATOR_URL not set, using default: https://validator.eas-attestor.com"
    export VALIDATOR_URL="https://validator.eas-attestor.com"
fi

echo "🔗 Validator URL: $VALIDATOR_URL"

# Generate production config
echo "📝 Generating production configuration..."
cat > src/main/html/config.js << EOF
// Production configuration generated at build time
window.ENV_CONFIG = {
  validatorUrl: '$VALIDATOR_URL',
  network: 'base',
  easAddress: '0x4200000000000000000000000000000000000021',
  schemaRegistryAddress: '0x4200000000000000000000000000000000000020'
};
EOF

echo "✅ Production config generated"

# Build the production dApp
echo "🔨 Building production dApp..."
task app:build:dist:prod

echo "🎉 Production build complete!"
echo "📁 Output directory: build/html/dist"
echo "🌐 Deploy the contents of build/html/dist to your hosting platform" 
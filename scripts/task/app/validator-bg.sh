#!/bin/bash
set -e

PORT=${1:-6001}
VALIDATOR_DIR="src/generated/server"

echo "🔐 Starting validator service in background on http://localhost:$PORT"

# Ensure validator dependencies are installed
if [ ! -d "$VALIDATOR_DIR/node_modules" ]; then
    echo "📦 Installing validator dependencies..."
    cd "$VALIDATOR_DIR"
    npm install
    cd - > /dev/null
fi

# Start validator in background
cd "$VALIDATOR_DIR"
# Pass environment variables needed by SignService
DEPLOY_CLOUD_STAGING_VALIDATOR_PRIVATE_KEY="${DEPLOY_CLOUD_STAGING_VALIDATOR_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}" \
PORT=$PORT node index.js > /tmp/validator.log 2>&1 &
VALIDATOR_PID=$!
cd - > /dev/null

# Save PID for cleanup
echo "$VALIDATOR_PID" > /tmp/validator.pid
echo "🔐 Validator PID: $VALIDATOR_PID"

# Wait for validator to be ready
echo "⏳ Waiting for validator to be ready..."
for i in {1..30}; do
    # Check if server is responding by attempting to connect to the port
    if nc -z localhost $PORT 2>/dev/null; then
        echo "✅ Validator ready at http://localhost:$PORT"
        echo "📄 Logs: /tmp/validator.log"
        exit 0
    fi
    sleep 1
done

echo "❌ Validator failed to start within 30 seconds"
echo "📄 Check logs: /tmp/validator.log"
kill $VALIDATOR_PID 2>/dev/null || true
exit 1
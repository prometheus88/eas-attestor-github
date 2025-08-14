#!/bin/bash
set -e

echo "🚀 Starting EAS Attestor for Github development environment..."

# Build the dApp
echo "📦 Building dApp..."
task app:build:dist

# Start Anvil in background
echo "⛓️  Starting Anvil fork..."
anvil --fork-url https://sepolia.base.org > /tmp/anvil.log 2>&1 &
ANVIL_PID=$!
sleep 3

# Start HTTP server in background  
echo "🌐 Starting dApp server..."
cd build/dist
python3 -m http.server 3000 > /tmp/server.log 2>&1 &
SERVER_PID=$!
cd ../..

# Wait for server to start
sleep 2

echo ""
echo "🎉 Development environment ready!"
echo "┌─────────────────────────────────────────┐"
echo "│  🌐 dApp: http://localhost:3000         │"
echo "│  ⛓️  Anvil: http://localhost:8545       │"  
echo "│  📖 Docs: http://localhost:3000/docs/   │"
echo "└─────────────────────────────────────────┘"
echo ""
echo "💡 Use 'task dev:stop' to stop all services"
echo "📄 Logs: /tmp/anvil.log, /tmp/server.log"

# Save PIDs for cleanup
echo "$ANVIL_PID" > /tmp/anvil.pid
echo "$SERVER_PID" > /tmp/server.pid

# Wait for any process to exit
wait
#!/bin/bash
set -e

PORT=${1:-3000}

echo "🌐 Starting dApp server in background on http://localhost:$PORT"

if command -v python3 >/dev/null 2>&1; then
  cd build/dist && python3 -m http.server $PORT > /tmp/server.log 2>&1 &
elif command -v python >/dev/null 2>&1; then
  cd build/dist && python -m http.server $PORT > /tmp/server.log 2>&1 &
elif command -v node >/dev/null 2>&1; then
  npx http-server build/dist -p $PORT -c-1 -s > /tmp/server.log 2>&1 &
else
  echo "❌ No HTTP server available. Install Python or Node.js"
  exit 1
fi

SERVER_PID=$!
echo "$SERVER_PID" > /tmp/server.pid
sleep 2
echo "✅ dApp server running at http://localhost:$PORT"
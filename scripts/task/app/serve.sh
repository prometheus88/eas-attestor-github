#!/bin/bash
set -e

PORT=${1:-3000}

echo "🌐 Serving dApp at http://localhost:$PORT"
echo "📁 Serving from build/dist"
echo "📖 Contract docs available at http://localhost:$PORT/docs/"
echo "Press Ctrl+C to stop server"

if command -v python3 >/dev/null 2>&1; then
  cd build/dist && python3 -m http.server $PORT
elif command -v python >/dev/null 2>&1; then
  cd build/dist && python -m http.server $PORT
elif command -v node >/dev/null 2>&1; then
  npx http-server build/dist -p $PORT -c-1
else
  echo "❌ No HTTP server available. Install Python or Node.js"
  exit 1
fi
#!/bin/bash
set -e

echo "🛑 Stopping development environment..."

# Stop Anvil
if [ -f /tmp/anvil.pid ]; then
  kill $(cat /tmp/anvil.pid) 2>/dev/null && echo "✅ Stopped Anvil" || echo "Anvil not running"
  rm -f /tmp/anvil.pid
else
  pkill -f anvil && echo "✅ Stopped Anvil" || echo "Anvil not running"
fi

# Stop HTTP server
if [ -f /tmp/server.pid ]; then
  kill $(cat /tmp/server.pid) 2>/dev/null && echo "✅ Stopped HTTP server" || echo "HTTP server not running"
  rm -f /tmp/server.pid
else
  pkill -f "http.server 3000" && echo "✅ Stopped HTTP server" || echo "HTTP server not running"
fi

# Clean up log files
rm -f /tmp/anvil.log /tmp/server.log

echo "🎉 Development environment stopped"
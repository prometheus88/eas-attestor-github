#!/bin/bash

echo "🛑 Stopping validator service..."

if [ -f /tmp/validator.pid ]; then
    VALIDATOR_PID=$(cat /tmp/validator.pid)
    if kill -0 $VALIDATOR_PID 2>/dev/null; then
        echo "🔐 Stopping validator (PID: $VALIDATOR_PID)"
        kill $VALIDATOR_PID
        
        # Wait for process to stop
        for i in {1..10}; do
            if ! kill -0 $VALIDATOR_PID 2>/dev/null; then
                break
            fi
            sleep 1
        done
        
        # Force kill if still running
        if kill -0 $VALIDATOR_PID 2>/dev/null; then
            echo "⚠️ Force killing validator"
            kill -9 $VALIDATOR_PID 2>/dev/null || true
        fi
        
        echo "✅ Validator stopped"
    else
        echo "⚠️ Validator not running (stale PID)"
    fi
    
    rm -f /tmp/validator.pid
else
    echo "⚠️ No validator PID found"
fi

# Clean up any remaining processes on port 6001
if lsof -t -i:6001 >/dev/null 2>&1; then
    echo "🧹 Cleaning up processes on port 6001"
    lsof -t -i:6001 | xargs kill -9 2>/dev/null || true
fi

echo "✅ Validator cleanup complete"
#!/bin/bash
# Start Macondo API server + React frontend and open browser

# Kill any existing instances
pkill -f 'macondo.*bin/api' 2>/dev/null
pkill -f 'vite.*macondo-ui' 2>/dev/null
sleep 1

# Go setup
export PATH="$HOME/go-arm64/go/bin:$PATH"
export GOROOT="$HOME/go-arm64/go"

# Start API server
cd /Users/dacrON/Documents/Sources/macondo
./bin/api &>/tmp/macondo-api.log &
API_PID=$!

# Start Vite dev server
source ~/.nvm/nvm.sh
cd /Users/dacrON/Documents/Sources/macondo-ui
npm run dev &>/tmp/macondo-ui.log &
VITE_PID=$!

# Wait for Vite to be ready then open browser
sleep 3
open http://localhost:5173/

echo "Macondo running! API PID=$API_PID, Vite PID=$VITE_PID"
echo "Press Ctrl+C to stop both servers."

# Wait and clean up on exit
trap "kill $API_PID $VITE_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait

#!/bin/bash
# Start backend in background
cd /home/runner/workspace/Nova-Insights-Backend && python app.py &
BACKEND_PID=$!

# Start frontend in foreground (this is the webview port)
cd /home/runner/workspace && npm run dev

# Cleanup backend on exit
kill $BACKEND_PID 2>/dev/null

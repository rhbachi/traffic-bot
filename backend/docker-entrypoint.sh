#!/bin/bash
set -e

# Start virtual display (needed by nodriver/Chromium even in headless mode)
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
export DISPLAY=:99

# Wait for Xvfb to be ready
sleep 1

# Start the FastAPI server
exec uvicorn main:app --host 0.0.0.0 --port 8000

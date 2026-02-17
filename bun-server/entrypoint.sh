#!/usr/bin/env bash
set -euo pipefail

export DISPLAY=:99

# Start Xvfb (virtual display) for visible Chromium sessions.
Xvfb :99 -screen 0 1280x1024x24 &

# Lightweight window manager for browser windows.
fluxbox >/dev/null 2>&1 &

exec "$@"

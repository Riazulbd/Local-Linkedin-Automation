#!/usr/bin/env bash
set -euo pipefail

export DISPLAY=:99

# Start Xvfb (virtual display) for visible Chromium sessions.
Xvfb :99 -screen 0 1280x1024x24 &

# Lightweight window manager for browser windows.
fluxbox >/dev/null 2>&1 &

# VNC server bound to localhost.
x11vnc -display :99 -forever -nopw -listen localhost -xkb >/dev/null 2>&1 &

# noVNC web client.
if [ -x /usr/share/novnc/utils/novnc_proxy ]; then
  /usr/share/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 6080 >/dev/null 2>&1 &
else
  websockify --web=/usr/share/novnc/ 6080 localhost:5900 >/dev/null 2>&1 &
fi

exec "$@"


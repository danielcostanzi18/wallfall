#!/usr/bin/env bash
# Start Wallfall: the local server + a Chrome window that may play sound without a click/key press.
# Uses its own Chrome profile (~/.config/wallfall-chrome) so your normal browser isn't affected.
# The camera permission is asked once in that profile and remembered.
#   ./start.sh [port] [page]   (default 8000, index.html; e.g. ./start.sh 8000 calibrate.html)
#   Ctrl+C or closing the window stops everything.
cd "$(dirname "$0")" || exit 1
PORT="${1:-8000}"
PAGE="${2:-}"
CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser)"
if [ -z "$CHROME" ]; then echo "Chrome/Chromium not found: run 'python3 serve.py' and open http://localhost:$PORT yourself"; exit 1; fi

python3 serve.py "$PORT" &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1

"$CHROME" --user-data-dir="$HOME/.config/wallfall-chrome" \
  --autoplay-policy=no-user-gesture-required \
  --app="http://localhost:$PORT/$PAGE" --start-fullscreen \
  --no-first-run --no-default-browser-check

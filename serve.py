#!/usr/bin/env python3
"""Serve Wallfall on http://localhost:PORT and print the game's log lines in this terminal.

Usage:  python3 serve.py [port]      (default 8000)

POST /log                        -> prints the lines in this terminal
POST /save/recordings/<name>/<file>.json, /save/profiles/<name>.json
                                 -> saves calibration data (JSON only, only into those two folders)
"""
import http.server
import json
import os
import re
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
SAVE_RE = re.compile(r"^/save/((?:recordings|profiles)/[A-Za-z0-9_-]{1,40}(?:/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,80})?\.json)$")
MAX_SAVE = 64 * 1024 * 1024


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0) or 0)
        if self.path == "/log":
            body = self.rfile.read(min(n, 256 * 1024)).decode("utf-8", "replace")
            for line in body.splitlines():
                print(f"[game] {line}", flush=True)
            self.send_response(204)
            self.end_headers()
            return
        m = SAVE_RE.match(self.path)
        if not m:
            self.send_error(404)
            return
        if n > MAX_SAVE:
            self.send_error(413, "too large")
            return
        body = self.rfile.read(n)
        try:
            json.loads(body)
        except ValueError:
            self.send_error(400, "not JSON")
            return
        rel = m.group(1)
        path = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(body)
        print(f"[saved] {rel} ({len(body) / 1024:.0f} KB)", flush=True)
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        # Never cache the game files: a normal reload always picks up the latest version.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Keep the terminal for game logs: only show failed requests.
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


os.chdir(os.path.dirname(os.path.abspath(__file__)))
server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
print(f"Wallfall: open http://localhost:{PORT}   (Ctrl+C to stop)", flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nbye")

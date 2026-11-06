#!/usr/bin/env python3
"""Serve Wallfall on http://localhost:PORT and print the game's log lines in this terminal.

Usage:  python3 serve.py [port]      (default 8000)
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/log":
            self.send_error(404)
            return
        n = min(int(self.headers.get("Content-Length", 0) or 0), 256 * 1024)
        body = self.rfile.read(n).decode("utf-8", "replace")
        for line in body.splitlines():
            print(f"[game] {line}", flush=True)
        self.send_response(204)
        self.end_headers()

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

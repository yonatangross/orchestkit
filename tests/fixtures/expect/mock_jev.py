#!/usr/bin/env python3
"""Mock Jev endpoint for tests.

POST: appends the raw request body (one line) to $MOCK_LOG, then replies
with the current contents of $MOCK_RESPONSE. The response file is re-read
per request so a test can swap canned answers between calls.
GET /count: replies with the number of POSTs seen so far.
"""

import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

LOG = os.environ["MOCK_LOG"]
RESP = os.environ["MOCK_RESPONSE"]

COUNT = 0


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        global COUNT
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length)
        COUNT += 1
        with open(LOG, "ab") as fh:
            fh.write(body + b"\n")
        try:
            with open(RESP, "rb") as fh:
                payload = fh.read()
        except OSError:
            payload = b"{}"
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        payload = str(COUNT).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()

#!/usr/bin/env python3
"""Mock Jev endpoint for tests.

POST: appends the raw request body (one line) to $MOCK_LOG, then replies
with the current contents of $MOCK_RESPONSE. The response file is re-read
per request so a test can swap canned answers between calls.
GET /count: replies with the number of POSTs seen so far.

Optional controls, both re-read per request:
  MOCK_STATUS_FILE  file containing an int HTTP status; non-200 replies
                    with that status and an empty JSON object
  MOCK_DELAY_FILE   file containing seconds to sleep before replying;
                    a value above the client latency budget exercises the
                    timeout path
"""

import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOG = os.environ["MOCK_LOG"]
RESP = os.environ["MOCK_RESPONSE"]
STATUS_FILE = os.environ.get("MOCK_STATUS_FILE")
DELAY_FILE = os.environ.get("MOCK_DELAY_FILE")

COUNT = 0


def _read(path, default):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read().strip()
    except (OSError, TypeError):
        return default


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        global COUNT
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length)
        COUNT += 1
        with open(LOG, "ab") as fh:
            fh.write(body + b"\n")
        if DELAY_FILE:
            try:
                time.sleep(float(_read(DELAY_FILE, "0") or 0))
            except ValueError:
                pass
        status = 200
        if STATUS_FILE:
            try:
                status = int(_read(STATUS_FILE, "200") or 200)
            except ValueError:
                pass
        try:
            with open(RESP, "rb") as fh:
                payload = fh.read()
        except OSError:
            payload = b"{}"
        if status >= 400:
            payload = b"{}"
        self.send_response(status)
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


ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()

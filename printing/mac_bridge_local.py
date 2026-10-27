#!/usr/bin/env python3
"""Cuncun Xprinter bridge: local diagnostic only. No public listener or account credentials."""
import os, socket, json, time
from http.server import HTTPServer, BaseHTTPRequestHandler

PRINTER_IP = os.getenv("CUNCUN_PRINTER_IP", "192.168.1.159")
PRINTER_PORT = int(os.getenv("CUNCUN_PRINTER_PORT", "9100"))
LISTEN_PORT = int(os.getenv("CUNCUN_BRIDGE_PORT", "8765"))

def print_bytes(payload):
    with socket.create_connection((PRINTER_IP, PRINTER_PORT), timeout=5) as conn:
        conn.sendall(payload)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_error(404); return
        body = json.dumps({"bridge":"ready","printer":PRINTER_IP,"port":PRINTER_PORT}).encode()
        self.send_response(200); self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_POST(self):
        # Only a physical Mac user can trigger a test via loopback; never accept untrusted print payloads.
        if self.path != "/test":
            self.send_error(404); return
        try:
            print_bytes(b"\x1b\x40CUNCUN PRINT TEST\nMAC MINI BRIDGE OK\n\n\n")
            self.send_response(200); self.end_headers(); self.wfile.write(b"PRINT OK")
        except OSError as exc:
            self.send_error(502, str(exc))

if __name__ == "__main__":
    print("Cuncun local bridge on http://127.0.0.1:%s/health" % LISTEN_PORT)
    HTTPServer(("127.0.0.1", LISTEN_PORT), Handler).serve_forever()

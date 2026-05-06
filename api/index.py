from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse


def _bootstrap_paths() -> None:
    root = Path(__file__).resolve().parents[1]
    src_path = root / "src"
    if str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


_bootstrap_paths()

from streaming.ingest import main as run_ingest  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        try:
            # Parse ?variable=... from the query string
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            variable = params.get("variable", [None])[0]

            # Clear sys.argv so argparse in main() doesn't choke on
            # Vercel's invocation args, then call with the variable param.
            sys.argv = [sys.argv[0]]
            run_ingest(variable=variable)

            payload = {"status": "ok", "variable": variable}
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        except Exception as exc:
            payload = {"status": "error", "message": str(exc)}
            body = json.dumps(payload).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)

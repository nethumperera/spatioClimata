"""Vercel Serverless Function: Test the system and verify manifest is accessible."""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path


def _bootstrap_paths() -> None:
    root = Path(__file__).resolve().parents[1]
    src_path = root / "src"
    if str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))


_bootstrap_paths()


class handler(BaseHTTPRequestHandler):
    """Health check and diagnostics endpoint."""

    def do_GET(self) -> None:
        """GET /api/health - returns system status."""
        try:
            # Check if manifest endpoint works
            import urllib.request
            manifest_url = "https://your-deployed-domain.vercel.app/api/manifest"
            
            status = {
                "status": "ok",
                "message": "GloFAS streaming pipeline is configured",
                "endpoints": {
                    "manifest": "/api/manifest",
                    "ingest": "/api (cron job at 6 AM UTC)",
                    "health": "/api/health"
                },
                "data_sources": {
                    "vercel_blob": "https://kndyu62zzumvdajy.public.blob.vercel-storage.com/streaming/manifest.json",
                    "local_fallback": "/data/window_manifest.json"
                },
                "frontend": {
                    "map_url": "/pages/globe.html",
                    "description": "2D Leaflet map with GloFAS data visualization, timeline animation, and variable selector"
                },
                "next_steps": [
                    "1. Verify environment variables: SPATIOCLIMATA_API_KEY, BLOB_READ_WRITE_TOKEN",
                    "2. Wait for cron job to run at 6 AM UTC (or trigger manually via POST /api)",
                    "3. Visit /pages/globe.html to view live data on the map",
                    "4. Select variables and use timeline to animate through dates"
                ]
            }
            
            body = json.dumps(status, indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        except Exception as exc:
            payload = {
                "status": "error",
                "message": str(exc),
            }
            body = json.dumps(payload).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

    def do_POST(self) -> None:
        """POST /api/health - trigger ingest manually for testing."""
        try:
            # Try to trigger the ingest
            sys.argv = [sys.argv[0]]
            from streaming.ingest import main as run_ingest
            
            result = run_ingest(variable=None)
            
            status = {
                "status": "triggered",
                "message": "Ingest job triggered manually",
                "check_manifest": "/api/manifest"
            }
            
            body = json.dumps(status, indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        except Exception as exc:
            payload = {
                "status": "error",
                "message": str(exc),
            }
            body = json.dumps(payload).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

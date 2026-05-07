"""Vercel Serverless Function: Serve GloFAS manifest and data URLs."""

from __future__ import annotations

import json
import sys
import os
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


class handler(BaseHTTPRequestHandler):
    """Serve the manifest from Vercel Blob or local filesystem."""

    def do_OPTIONS(self) -> None:
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.end_headers()

    def do_GET(self) -> None:
        """GET /api/manifest - returns available data with URLs."""
        try:
            # Try to fetch from Vercel Blob first (live data from cron)
            manifest = self._fetch_blob_manifest()
            
            # Fallback to local if Blob fetch fails or returns empty
            if not manifest:
                manifest = self._fetch_local_manifest()
            
            # If still empty, return demo data structure
            if not manifest:
                manifest = self._demo_manifest()

            body = json.dumps(manifest).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.end_headers()
            self.wfile.write(body)

        except Exception as exc:
            payload = {
                "status": "error",
                "message": str(exc),
                "data": self._demo_manifest(),
            }
            body = json.dumps(payload).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.end_headers()
            self.wfile.write(body)

    def _fetch_blob_manifest(self) -> dict | None:
        """Fetch manifest from Vercel Blob storage (public URL)."""
        try:
            import urllib.request
            
            blob_url = "https://kndyu62zzumvdajy.public.blob.vercel-storage.com/streaming/manifest.json"
            with urllib.request.urlopen(blob_url, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            return None

    def _fetch_local_manifest(self) -> dict | None:
        """Fetch manifest from local filesystem (for development/caching)."""
        try:
            manifest_path = Path(__file__).resolve().parents[1] / "data" / "window_manifest.json"
            if manifest_path.exists():
                return json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception:
            pass
        return None

    def _demo_manifest(self) -> dict:
        """Return demo data structure (placeholder when no real data available)."""
        return {
            "status": "demo",
            "message": "No real data available yet. Waiting for first cron run at 6 AM.",
            "variables": [
                {
                    "name": "river_discharge_in_the_last_24_hours",
                    "label": "River Discharge (24h)",
                    "unit": "m³/s",
                    "range": [0, 5000],
                    "dates": [
                        {
                            "date": "2025-05-01",
                            "url": "https://example.com/demo/river_discharge_2025-05-01.json",
                        }
                    ],
                },
                {
                    "name": "soil_wetness_index_root_zone",
                    "label": "Soil Wetness Index",
                    "unit": "–",
                    "range": [0, 1],
                    "dates": [
                        {
                            "date": "2025-05-01",
                            "url": "https://example.com/demo/soil_wetness_2025-05-01.json",
                        }
                    ],
                },
                {
                    "name": "runoff_water_equivalent",
                    "label": "Runoff Water Equiv.",
                    "unit": "kg/m²",
                    "range": [0, 50],
                    "dates": [
                        {
                            "date": "2025-05-01",
                            "url": "https://example.com/demo/runoff_2025-05-01.json",
                        }
                    ],
                },
            ],
        }

"""Credential onboarding and Copernicus client creation."""

from __future__ import annotations

import getpass
import json
import os
import webbrowser
from dataclasses import dataclass
from pathlib import Path

import cdsapi

from .exceptions import CredentialError

CDS_URL = "https://cds.climate.copernicus.eu/api"
EWDS_URL = "https://ewds.climate.copernicus.eu/api"
SIGNUP_URL = "https://cds.climate.copernicus.eu/user/register"
API_HELP_URL = "https://cds.climate.copernicus.eu/how-to-api"

_ENV_KEY_PRIORITY = (
    "SPATIOCLIMATA_API_KEY",
    "ERA5_Key",
    "ERA5_KEY",
)

_CREDENTIALS_DIR = Path.home() / ".spatioclimata"
_CREDENTIALS_FILE = _CREDENTIALS_DIR / "credentials.json"


@dataclass
class CopernicusClients:
    cds: cdsapi.Client
    ewds: cdsapi.Client
    api_key: str


def _mask_key(key: str) -> str:
    if len(key) <= 8:
        return "*" * len(key)
    return f"{key[:4]}{'*' * (len(key) - 8)}{key[-4:]}"


def _load_saved_key() -> str | None:
    if not _CREDENTIALS_FILE.exists():
        return None
    try:
        payload = json.loads(_CREDENTIALS_FILE.read_text(encoding="utf-8"))
        api_key = payload.get("api_key", "").strip()
        return api_key or None
    except (json.JSONDecodeError, OSError):
        return None


def save_api_key(api_key: str) -> Path:
    """Persist API key in user-local config path."""
    _CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    _CREDENTIALS_FILE.write_text(json.dumps({"api_key": api_key.strip()}, indent=2), encoding="utf-8")

    # Restrict permissions where possible.
    try:
        os.chmod(_CREDENTIALS_FILE, 0o600)
    except OSError:
        pass

    return _CREDENTIALS_FILE


def resolve_api_key(api_key: str | None = None) -> str | None:
    if api_key and api_key.strip():
        return api_key.strip()

    for key_name in _ENV_KEY_PRIORITY:
        env_val = os.getenv(key_name)
        if env_val and env_val.strip():
            return env_val.strip()

    return _load_saved_key()


def init_auth(
    api_key: str | None = None,
    open_browser: bool = False,
    interactive: bool = True,
) -> str:
    """Initialize or update local authentication credentials."""
    key = resolve_api_key(api_key)

    if key:
        save_api_key(key)
        return _mask_key(key)

    if not interactive:
        raise CredentialError(
            "No API key found. Set SPATIOCLIMATA_API_KEY or run interactive setup."
        )

    if open_browser:
        webbrowser.open(SIGNUP_URL)
        webbrowser.open(API_HELP_URL)

    prompt = (
        "Enter Copernicus API key (format usually <uid>:<token>) "
        "or press Enter to cancel: "
    )
    entered = getpass.getpass(prompt).strip()
    if not entered:
        raise CredentialError("API key setup cancelled by user.")

    save_api_key(entered)
    return _mask_key(entered)


def build_clients(
    api_key: str | None = None,
    open_browser_on_missing_key: bool = False,
    interactive_on_missing_key: bool = False,
) -> CopernicusClients:
    """Create authenticated CDS and EWDS clients."""
    resolved = resolve_api_key(api_key)
    if not resolved and interactive_on_missing_key:
        init_auth(open_browser=open_browser_on_missing_key, interactive=True)
        resolved = resolve_api_key()

    if not resolved:
        raise CredentialError(
            "Missing Copernicus API key. Run spatioclimata auth init --open-browser, "
            "or set SPATIOCLIMATA_API_KEY."
        )

    cds_client = cdsapi.Client(url=CDS_URL, key=resolved, quiet=True, progress=False)
    ewds_client = cdsapi.Client(url=EWDS_URL, key=resolved, quiet=True, progress=False)

    return CopernicusClients(cds=cds_client, ewds=ewds_client, api_key=resolved)

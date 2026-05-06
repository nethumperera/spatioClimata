from __future__ import annotations

import json
import os
import shutil
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from spatioclimata import AreaBBox, FetchRequest, TimeRange, fetch
from spatioclimata.auth import resolve_api_key



def load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _env_override(name: str, default: str | None) -> str | None:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


def ensure_env(env_file: str | None) -> None:
    if env_file:
        load_dotenv(env_file)
    if not resolve_api_key():
        raise RuntimeError(
            "Copernicus API key not found. Set SPATIOCLIMATA_API_KEY or ERA5_Key in the .env file."
        )


def compute_window(retention_days: int, lag_days: int) -> tuple[date, date]:
    today = datetime.now(timezone.utc).date()
    end_date = today - timedelta(days=lag_days)
    start_date = end_date - timedelta(days=retention_days - 1)
    return start_date, end_date


def reset_output_dir(output_root: Path) -> None:
    if not output_root.exists():
        output_root.mkdir(parents=True, exist_ok=True)
        return

    for item in output_root.iterdir():
        try:
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
        except OSError:
            # Ignore locked files; next run can clean up.
            pass


def write_manifest(output_root: Path, payload: dict[str, Any]) -> None:
    manifest_path = output_root / "window_manifest.json"
    manifest_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def resolve_output_root(config_path: Path, value: str) -> Path:
    raw = Path(value).expanduser()
    if raw.is_absolute():
        return raw
    return config_path.parent / raw


def main() -> None:
    config_path = Path(__file__).with_name("config.json")
    config = load_config(config_path)

    env_file = _env_override("STREAMING_ENV_FILE", config.get("env_file"))
    ensure_env(env_file)

    retention_days = int(_env_override("STREAMING_RETENTION_DAYS", str(config.get("retention_days", 7))))
    lag_days = int(_env_override("STREAMING_LAG_DAYS", str(config.get("lag_days", 2))))
    start_date, end_date = compute_window(retention_days, lag_days)

    vercel_default_root = "/tmp/streaming/data" if os.getenv("VERCEL") == "1" else None
    default_root = vercel_default_root or config.get("output_root", "./data")
    output_root_value = _env_override("STREAMING_OUTPUT_ROOT", default_root)
    output_root = resolve_output_root(config_path, output_root_value)

    if bool(config.get("reset_on_start", True)):
        reset_output_dir(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    area_values = config.get("area")
    area = AreaBBox.from_sequence(area_values) if area_values else None

    grid_values = config.get("grid")
    grid = tuple(grid_values) if grid_values else None

    extra_params = config.get("extra_params") or {}

    request = FetchRequest(
        dataset=config.get("dataset", "reanalysis-era5-single-levels"),
        variables=list(config.get("variables", [])),
        time_range=TimeRange.from_strings(start_date.isoformat(), end_date.isoformat()),
        area=area,
        frequency=config.get("frequency", "hourly"),
        output_dir=str(output_root),
        merge_strategy=config.get("merge_strategy", "none"),
        grid=grid,
        extra_params=extra_params,
        overwrite=True,
    )

    result = fetch(request, open_browser_on_missing_key=False, interactive_on_missing_key=False)

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "frequency": request.frequency,
        "variables": request.variables,
        "grid": list(grid) if grid else None,
        "area": area.as_list() if area else None,
        "downloaded_files": result.downloaded_files,
        "processed_files": result.processed_files,
        "saved_files": result.saved_files,
        "warnings": result.warnings,
    }
    write_manifest(output_root, manifest)




if __name__ == "__main__":
    main()

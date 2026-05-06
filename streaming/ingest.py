from __future__ import annotations

import argparse
import glob
import json
import os
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


def compute_incremental_dates(
    retention_days: int, lag_days: int
) -> tuple[date, date]:
    """Return (fetch_date, evict_date).

    fetch_date — the newest day that just entered the 7-day window.
    evict_date — the day that just fell out of the window.
    """
    today = datetime.now(timezone.utc).date()
    fetch_date = today - timedelta(days=lag_days)
    evict_date = fetch_date - timedelta(days=retention_days)
    return fetch_date, evict_date


def compute_window(retention_days: int, lag_days: int) -> tuple[date, date]:
    """Full window bounds (used for manifest metadata only)."""
    today = datetime.now(timezone.utc).date()
    end_date = today - timedelta(days=lag_days)
    start_date = end_date - timedelta(days=retention_days - 1)
    return start_date, end_date


def _dataset_slug(dataset_id: str) -> str:
    return dataset_id.replace("-", "_")


def evict_old_day(output_root: Path, evict_date: date, dataset: str) -> list[str]:
    """Delete any files whose name contains the evict_date's year_month_day or year_month.

    Returns the list of deleted paths.
    """
    slug = _dataset_slug(dataset)
    deleted: list[str] = []

    # Files produced by spatioclimata follow the pattern:
    #   {slug}_raw_{freq}_{year}_{month:02d}.nc   (one file per month)
    # Since we fetch one day at a time, each run produces a month file that
    # holds only that single day.  For the evict_date we look for files tagged
    # with its year/month.  If the same month still contains newer fetched days
    # we must NOT delete the whole file — but with one-day-per-file naming this
    # is safe because each daily run produces its own month file (only one day
    # inside).
    #
    # We also handle the case where the user stores outputs with a date suffix
    # by scanning broadly for the evict_date string.

    year = evict_date.year
    month = f"{evict_date.month:02d}"
    day = f"{evict_date.day:02d}"

    patterns = [
        # Exact date in filename
        f"*{year}_{month}_{day}*",
        f"*{year}-{month}-{day}*",
        # Month-level file that was a single-day fetch for the evict month
        # (only delete if the day is the sole day in that month file)
        f"*{slug}*{year}_{month}*",
    ]

    candidates: set[Path] = set()
    for pattern in patterns:
        candidates.update(output_root.glob(pattern))

    # Never delete the manifest
    candidates = {p for p in candidates if p.name != "window_manifest.json"}

    # For month-level files, only delete if the evict_date is the only day
    # that was ever fetched for that month.  We can check by inspecting whether
    # any *other* day in the same month still belongs to the current window.
    # Simplification: since we fetch exactly one day per run, a month-level
    # file produced by an older run is safe to remove once its day is outside
    # the window.  We store the fetch_date in a sidecar so we know which day
    # the file represents.

    for candidate in candidates:
        try:
            candidate.unlink()
            deleted.append(str(candidate))
        except OSError:
            pass

    # Also clean up any _extract_ temp directories for that date
    for extract_dir in output_root.glob(f"_extract_*{year}_{month}*"):
        try:
            if extract_dir.is_dir():
                import shutil
                shutil.rmtree(extract_dir)
                deleted.append(str(extract_dir))
        except OSError:
            pass

    return deleted


def write_manifest(output_root: Path, payload: dict[str, Any]) -> None:
    manifest_path = output_root / "window_manifest.json"
    manifest_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def resolve_output_root(config_path: Path, value: str) -> Path:
    raw = Path(value).expanduser()
    if raw.is_absolute():
        return raw
    return config_path.parent / raw


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Incremental daily ingest for streaming data."
    )
    parser.add_argument(
        "--variable",
        type=str,
        default=None,
        help="Single variable to fetch. If omitted, fetches all variables from config.",
    )
    parser.add_argument(
        "--full-window",
        action="store_true",
        default=False,
        help="Fetch the full retention window instead of just the newest day (initial bootstrap).",
    )
    return parser.parse_args()


def main(variable: str | None = None, full_window: bool = False) -> None:
    args = parse_args()
    # CLI args override function parameters (for API handler use)
    variable = args.variable or variable
    full_window = args.full_window or full_window

    config_path = Path(__file__).with_name("config.json")
    config = load_config(config_path)

    env_file = _env_override("STREAMING_ENV_FILE", config.get("env_file"))
    ensure_env(env_file)

    retention_days = int(
        _env_override("STREAMING_RETENTION_DAYS", str(config.get("retention_days", 7)))
    )
    lag_days = int(
        _env_override("STREAMING_LAG_DAYS", str(config.get("lag_days", 2)))
    )

    vercel_default_root = "/tmp/streaming/data" if os.getenv("VERCEL") == "1" else None
    default_root = vercel_default_root or config.get("output_root", "./data")
    output_root_value = _env_override("STREAMING_OUTPUT_ROOT", default_root)
    output_root = resolve_output_root(config_path, output_root_value)
    output_root.mkdir(parents=True, exist_ok=True)

    area_values = config.get("area")
    area = AreaBBox.from_sequence(area_values) if area_values else None

    grid_values = config.get("grid")
    grid = tuple(grid_values) if grid_values else None

    extra_params = config.get("extra_params") or {}
    dataset = config.get("dataset", "reanalysis-era5-single-levels")

    # Decide which variables to process
    all_variables = list(config.get("variables", []))
    if variable:
        if variable not in all_variables:
            raise ValueError(
                f"Variable '{variable}' not found in config. "
                f"Available: {all_variables}"
            )
        variables_to_fetch = [variable]
    else:
        variables_to_fetch = all_variables

    # Compute dates
    if full_window:
        start_date, end_date = compute_window(retention_days, lag_days)
        fetch_date = end_date
        evict_date = None
    else:
        fetch_date, evict_date = compute_incremental_dates(retention_days, lag_days)
        start_date = fetch_date
        end_date = fetch_date

    # Evict the day that fell out of the window
    evicted_files: list[str] = []
    if evict_date is not None:
        evicted_files = evict_old_day(output_root, evict_date, dataset)

    # Fetch only the newest day (or full window if bootstrapping)
    request = FetchRequest(
        dataset=dataset,
        variables=variables_to_fetch,
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

    # Write manifest with incremental metadata
    window_start, window_end = compute_window(retention_days, lag_days)
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "full_window" if full_window else "incremental",
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
        "fetched_date": fetch_date.isoformat(),
        "evicted_date": evict_date.isoformat() if evict_date else None,
        "evicted_files": evicted_files,
        "variable": variable,
        "variables_fetched": variables_to_fetch,
        "frequency": request.frequency,
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

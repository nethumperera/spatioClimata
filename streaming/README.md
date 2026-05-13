# Streaming Ingest (ERA5 live window — Incremental Daily)

This folder contains the ingestion script that maintains a rolling 7-day ERA5
window for the live globe. Each daily run fetches **only the newest day**, writes
the published JSON into `website/data/`, and commits those updates so GitHub Pages
can serve the live map without external storage.

## How it works

1. Computes the newest day: `today − lag_days`.
2. Computes the eviction day: `newest_day − retention_days`.
3. Deletes any published JSON files for the eviction day.
4. Fetches the newest day from Copernicus ERA5.
5. Writes `website/data/manifest.json` and the matching grid files.

Each variable is processed in a separate run via the `--variable` flag, allowing
parallel or staggered scheduling if needed.

## Configuration

Edit `config_era5.json` to update:

- `env_file`: path to the .env file with your API key (or set `STREAMING_ENV_FILE`)
- `variables`: live ERA5 variables to download
- `retention_days`: number of days in the sliding window (default: 7)
- `lag_days`: how many days behind "today" to avoid missing data (default: 2)
- `output_root`: where to store downloaded NetCDF files (or set `STREAMING_OUTPUT_ROOT`)

Environment overrides:

- `STREAMING_ENV_FILE`
- `STREAMING_OUTPUT_ROOT`
- `STREAMING_RETENTION_DAYS`
- `STREAMING_LAG_DAYS`

## CLI usage

```bash
# Fetch a single ERA5 variable (incremental — one day)
python streaming/ingest.py --config streaming/config_era5.json --variable total_precipitation

# Fetch all ERA5 variables (incremental — one day each)
python streaming/ingest.py --config streaming/config_era5.json

# Bootstrap: fetch the full 7-day window for all ERA5 variables
python streaming/ingest.py --config streaming/config_era5.json --full-window
```

## Run locally (Windows)

```powershell
# Single variable
.\streaming\run_ingest.ps1 -Config streaming/config_era5.json -Variable total_precipitation

# All variables sequentially
.\streaming\run_ingest.ps1 -Config streaming/config_era5.json
```

## Scheduling

### Primary: GitHub Actions (daily, ERA5 only)

The `.github/workflows/ingest-era5.yml` workflow runs once daily at 20:00 IST,
publishes the live ERA5 JSON into `website/data/`, and commits the updated window
back to `main` so the GitHub Pages deployment stays current.

You can also trigger it manually via `workflow_dispatch` to bootstrap the full window.

## Secrets required

- `SPATIOCLIMATA_API_KEY` — set as a GitHub Actions secret.

## Notes

- Use `--full-window` for the first run to backfill the entire 7-day window.
- The globe currently uses precipitation, temperature, and wind component variables.
- Wind direction is derived from the ERA5 U/V components in the visualization.

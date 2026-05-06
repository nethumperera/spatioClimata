# Streaming Ingest (GloFAS, 7-day window — Incremental Daily)

This folder contains an ingestion script that maintains a sliding 7-day window of
GloFAS data for global visualization. Each daily run fetches **only the newest day**
and **deletes the day that just fell out** of the window.

## How it works

1. Computes the newest day: `today − lag_days`.
2. Computes the eviction day: `newest_day − retention_days`.
3. Deletes any files for the eviction day.
4. Fetches only the newest day from Copernicus.
5. Writes `window_manifest.json` with metadata about the run.

Each variable is processed in a separate run via the `--variable` flag, allowing
parallel or staggered scheduling.

## Configuration

Edit `config.json` to update:
- `env_file`: path to the .env file with your API key (or set `STREAMING_ENV_FILE`)
- `variables`: master list of variables to download
- `retention_days`: number of days in the sliding window (default: 7)
- `lag_days`: how many days behind "today" to avoid missing data (default: 2)
- `output_root`: where to store downloaded files (or set `STREAMING_OUTPUT_ROOT`)

Environment overrides:
- `STREAMING_ENV_FILE`
- `STREAMING_OUTPUT_ROOT`
- `STREAMING_RETENTION_DAYS`
- `STREAMING_LAG_DAYS`

## CLI usage

```bash
# Fetch a single variable (incremental — one day)
python streaming/ingest.py --variable river_discharge_in_the_last_24_hours

# Fetch all variables (incremental — one day each)
python streaming/ingest.py

# Bootstrap: fetch the full 7-day window for all variables
python streaming/ingest.py --full-window
```

## Run locally (Windows)

```powershell
# Single variable
.\streaming\run_ingest.ps1 -Variable river_discharge_in_the_last_24_hours

# All variables sequentially
.\streaming\run_ingest.ps1
```

## Scheduling

### Primary: GitHub Actions (daily, per-variable)

The `.github/workflows/ingest.yml` workflow runs once daily at 06:00 UTC with a
matrix strategy — one job per variable, serialised to respect CDS rate limits.

You can also trigger it manually via `workflow_dispatch` for a specific variable
or to bootstrap the full window.

### Fallback: Vercel Cron (daily, all variables)

`vercel.json` defines a single daily cron at 06:00 UTC that hits `/api/ingest`.
The Vercel function processes all variables in one request (free tier allows only
1 cron job, max 300 seconds).

## Secrets required

- `SPATIOCLIMATA_API_KEY` — set as a GitHub Actions secret and/or Vercel env var.

## Notes

- GloFAS availability can lag by 1–3 days. Adjust `lag_days` if you see missing data.
- The manifest can be used by your map service to discover the latest window.
- For higher throughput, move tiles to object storage.
- Use `--full-window` for the first run to backfill the entire 7-day window.

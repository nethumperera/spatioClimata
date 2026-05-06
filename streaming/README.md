# Streaming Ingest (GloFAS, 7-day window)

This folder contains a small ingestion script that keeps a sliding 7-day window of
GloFAS data for global visualization. It fetches daily data, stores it locally, and
writes a manifest describing the files and date range.

## What it does

- Loads the Copernicus key from the .env file or environment variables.
- Fetches a rolling 7-day window of daily GloFAS data (global).
- Deletes old files before each run to keep storage small.
- Writes `window_manifest.json` with metadata for the map client.

## Configuration

Edit `config.json` to update:
- `env_file`: path to the .env file with your API key
- `variables`: variables to download (curated core set)
- `grid`: not used for GloFAS (omit or leave unset)
- `retention_days`: number of days to keep
- `lag_days`: how many days behind "today" to avoid missing ERA5T data
- `output_root`: where to store downloaded files

Environment overrides:
- `STREAMING_ENV_FILE`
- `STREAMING_OUTPUT_ROOT`
- `STREAMING_RETENTION_DAYS`
- `STREAMING_LAG_DAYS`

## Run locally

From the repo root:

```
C:/Users/HP/Documents/Programming/code/Scripts/python.exe -m pip install -e .
C:/Users/HP/Documents/Programming/code/Scripts/python.exe -m pip install -r streaming/requirements.txt
C:/Users/HP/Documents/Programming/code/Scripts/python.exe streaming/ingest.py
```

## Vercel deployment notes

Vercel provides cron scheduling, but the filesystem is ephemeral. For production
storage, plan to upload outputs to a durable store (for example Vercel Blob) or
another object store your map can read from.

Recommended environment variables:

- `SPATIOCLIMATA_API_KEY`
- `STREAMING_OUTPUT_ROOT` (use `/tmp/streaming/data` on Vercel)

## Scheduling (every 2 hours)

Use Render Cron Jobs or Windows Task Scheduler. Example cron:

```
0 */2 * * *
```

## Notes

- GloFAS availability can lag by 1-3 days. Adjust `lag_days` if you see missing data.
- The manifest can be used by your map service to discover the latest window.
- For higher throughput, move tiles to object storage.

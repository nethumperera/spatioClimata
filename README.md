# spatioClimata

spatioClimata is a Python package for requesting, validating, downloading, and transforming Copernicus climate and hydrology datasets into analytics-ready outputs.

It is designed for ERA5, GloFAS, and extensible CDS/EWDS datasets, with an opinionated data engineering pipeline and optional Dask acceleration.

## Why spatioClimata

- Unified access to CDS and EWDS with one API key workflow.
- Dataset capability checks before large downloads.
- Hourly and daily workflows with optional frequency conversion.
- Resumable, idempotent download pipeline for long-running jobs.
- Analytics-ready outputs as xarray Dataset with NetCDF/Zarr export.
- Optional Dask integration for chunked processing at scale.

## Installation

```bash
pip install spatioClimata
```

For Dask-enabled workflows:

```bash
pip install "spatioClimata[dask]"
```

For development:

```bash
pip install "spatioClimata[dev,dask]"
```

## Quick Start

```python
from spatioclimata import (
    AreaBBox,
    TimeRange,
    FetchRequest,
    fetch,
)

request = FetchRequest(
    dataset="derived-era5-single-levels-daily-statistics",
    variables=["total_precipitation", "2m_temperature"],
  time_range=TimeRange.from_strings("2020-01-01", "2020-12-31"),
  area=AreaBBox.from_sequence([6.22, 80.41, 5.91, 80.64]),
    frequency="daily",
    output_dir="./outputs",
)

result = fetch(request, open_browser_on_missing_key=True)
print(result.saved_files)
```

## CLI Usage

Initialize credentials:

```bash
spatioclimata auth init --open-browser
```

List datasets:

```bash
spatioclimata datasets list
```

Run a download:

```bash
spatioclimata fetch \
  --dataset derived-era5-single-levels-daily-statistics \
  --variables total_precipitation,2m_temperature \
  --start 2020-01-01 \
  --end 2020-12-31 \
  --area 6.22,80.41,5.91,80.64 \
  --frequency daily \
  --output-dir ./outputs
```

## Account and API Key Onboarding

The package needs a Copernicus API key.

- `spatioclimata auth init --open-browser` opens signup and API key pages.
- Credentials are saved to a local config file with restricted permissions when possible.
- Environment variables are also supported:
  - `SPATIOCLIMATA_API_KEY`
  - `ERA5_Key`

## Project Layout

- `src/spatioclimata/`: package source
- `tests/`: unit tests
- `examples/`: runnable usage examples
- `docs/`: architecture and usage guides
- `.github/workflows/`: CI
- `website/`: static project website (GitHub Pages source)
- `scripts/`: helper scripts for repo bootstrap, website sync, and releases

## Documentation Index

- [Quickstart](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Pipeline Guide](docs/pipeline.md)
- [Dataset Support](docs/dataset-support.md)
- [Release and Deploy](docs/release-deploy.md)

## Status

Current release is an MVP foundation intended to be expanded with additional dataset adapters and transformations.

## Release and Deployment

### PyPI Publish

- Workflow: `.github/workflows/publish-pypi.yml`
- Trigger: push a version tag (example: `v0.1.0`)
- Recommended: configure PyPI Trusted Publishing for this repository

### Website Deploy

- Workflow: `.github/workflows/deploy-pages.yml`
- Source folder: `website/`
- Trigger: push to `main` when website files change
- GitHub setting required: enable GitHub Pages with "GitHub Actions" as source

### Live Data Publish

- Workflow: `.github/workflows/ingest-era5.yml`
- Trigger: daily schedule at 20:00 IST, plus manual dispatch
- Output: updates `website/data/` with the live ERA5 window and commits it back to `main`
- Result: GitHub Pages serves the updated globe without external storage or serverless API routes

## License

MIT

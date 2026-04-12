# Architecture

spatioClimata is organized in layered components.

## Layers

1. Access Layer
- `auth.py`: credential onboarding and CDS/EWDS clients.
- `catalog.py`: dataset capability registry.
- `request_builder.py`: monthly payload generation.

2. Validation Layer
- `validation.py`: request checks and source frequency planning.

3. Pipeline Layer
- `pipeline.py`: retrieval orchestration, retries, transformations, merge strategy.
- `io.py`: robust open/extract helpers with engine fallback.
- `transforms.py`: resampling and spatial subsetting.

4. Interface Layer
- `api.py`: Python API.
- `cli.py`: command line interface.

## Data Flow

1. User defines `FetchRequest`.
2. Catalog and validation resolve capability + source frequency.
3. Monthly requests are generated and downloaded with retry.
4. Data is transformed to requested frequency and spatial extent.
5. Outputs are persisted by merge strategy (`none`, `monthly`, `yearly`).

# Pipeline Guide

## Core Features

- Idempotent reruns through output file existence checks.
- Exponential backoff retries for transient API/network failures.
- Optional Dask chunk execution for larger datasets.
- Frequency conversion (`hourly -> daily`, `daily/hourly -> monthly`).
- Spatial clipping by bounding box when coordinates exist.

## Merge Strategies

- `none`: keep raw monthly downloads.
- `monthly`: keep transformed monthly outputs.
- `yearly`: merge transformed monthly outputs into yearly files.

## Dask Usage

Enable Dask by setting `use_dask=True` and optional `chunks`.

Example:

```python
FetchRequest(
    ...,
    use_dask=True,
    chunks={"time": 240, "latitude": 16, "longitude": 16},
)
```

## Performance Tips

- Prefer native daily products over hourly+resample where available.
- Use native grid resolution unless analysis requires finer interpolation.
- Keep area bounds tight to avoid unnecessary transfer volume.
- Use yearly merge for long ranges to reduce downstream file handling overhead.

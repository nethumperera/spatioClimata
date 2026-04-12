# Quickstart

## 1. Install

```bash
pip install spatioClimata
```

For Dask workflows:

```bash
pip install "spatioClimata[dask]"
```

## 2. Initialize Authentication

```bash
spatioclimata auth init --open-browser
```

This can open Copernicus account and API docs pages if needed.

## 3. List Datasets

```bash
spatioclimata datasets list
```

## 4. Download Data

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

## 5. Use in Python

```python
from spatioclimata import AreaBBox, FetchRequest, TimeRange, fetch

request = FetchRequest(
    dataset="reanalysis-era5-single-levels",
    variables=["total_precipitation"],
    time_range=TimeRange.from_strings("2021-01-01", "2021-01-31"),
    area=AreaBBox.from_sequence([6.22, 80.41, 5.91, 80.64]),
    frequency="daily",
    output_dir="./outputs",
)

result = fetch(request)
print(result.saved_files)
```

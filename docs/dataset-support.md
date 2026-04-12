# Dataset Support

## Built-in Datasets

## reanalysis-era5-single-levels

- API: CDS
- Native frequency: hourly
- Typical usage: atmospheric and land-surface variables
- Supports area and grid controls

## derived-era5-single-levels-daily-statistics

- API: CDS
- Native frequency: daily
- Typical usage: daily aggregates without client-side resampling
- Supports area and grid controls

## cems-glofas-historical

- API: EWDS
- Native frequency: daily
- Typical usage: river discharge time series
- Uses historical request keys (`hyear`, `hmonth`, `hday`)

## Extending the Catalog

You can register additional datasets with custom defaults and capabilities by using `DatasetCatalog.register(...)` and passing your catalog to `fetch(...)`.

## Important Scope Rule

spatioClimata guarantees behavior for registered dataset capabilities. Requests outside registered metadata can still be attempted if you extend the catalog, but validation quality depends on metadata completeness.

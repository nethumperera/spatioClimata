"""Example using Dask-enabled processing."""

from spatioclimata import AreaBBox, FetchRequest, TimeRange, fetch

request = FetchRequest(
    dataset="reanalysis-era5-single-levels",
    variables=["surface_runoff", "sub_surface_runoff", "total_precipitation"],
    time_range=TimeRange.from_strings("2020-01-01", "2020-12-31"),
    area=AreaBBox.from_sequence([6.22, 80.41, 5.91, 80.64]),
    frequency="daily",
    output_dir="./outputs/dask",
    use_dask=True,
    chunks={"time": 240, "latitude": 16, "longitude": 16},
)

result = fetch(request, open_browser_on_missing_key=False, interactive_on_missing_key=False)
print(f"Outputs generated: {len(result.saved_files)}")

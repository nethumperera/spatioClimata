"""Minimal example for fetching daily ERA5 data."""

from spatioclimata import AreaBBox, FetchRequest, TimeRange, fetch

request = FetchRequest(
    dataset="derived-era5-single-levels-daily-statistics",
    variables=["total_precipitation", "2m_temperature"],
    time_range=TimeRange.from_strings("2021-01-01", "2021-03-31"),
    area=AreaBBox.from_sequence([6.22, 80.41, 5.91, 80.64]),
    frequency="daily",
    output_dir="./outputs/basic",
)

result = fetch(request, open_browser_on_missing_key=True, interactive_on_missing_key=True)
print("Saved files:")
for file in result.saved_files:
    print(f"- {file}")

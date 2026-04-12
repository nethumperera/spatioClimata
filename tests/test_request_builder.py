from spatioclimata.catalog import DEFAULT_CATALOG
from spatioclimata.models import AreaBBox, FetchRequest, TimeRange
from spatioclimata.request_builder import build_monthly_request


def test_glofas_product_type_changes_with_year() -> None:
    req = FetchRequest(
        dataset="cems-glofas-historical",
        variables=["river_discharge_in_the_last_24_hours"],
        time_range=TimeRange.from_strings("2020-01-01", "2020-01-31"),
        area=AreaBBox.from_sequence([6.22, 80.41, 5.91, 80.64]),
        frequency="daily",
    )
    cap = DEFAULT_CATALOG.get(req.dataset)
    payload = build_monthly_request(req, cap, 2020, 1, "daily")
    assert payload["product_type"] == "consolidated"



def test_era5_hourly_includes_time_field() -> None:
    req = FetchRequest(
        dataset="reanalysis-era5-single-levels",
        variables=["total_precipitation"],
        time_range=TimeRange.from_strings("2020-01-01", "2020-01-31"),
        area=AreaBBox.from_sequence([6.22, 80.41, 5.91, 80.64]),
        frequency="hourly",
    )
    cap = DEFAULT_CATALOG.get(req.dataset)
    payload = build_monthly_request(req, cap, 2020, 1, "hourly")
    assert len(payload["time"]) == 24

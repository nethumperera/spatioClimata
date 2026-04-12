import pytest

from spatioclimata.catalog import DEFAULT_CATALOG
from spatioclimata.exceptions import ValidationError
from spatioclimata.models import AreaBBox, FetchRequest, TimeRange
from spatioclimata.validation import resolve_source_frequency, validate_request


def _base_request(**overrides):
    payload = {
        "dataset": "reanalysis-era5-single-levels",
        "variables": ["total_precipitation"],
        "time_range": TimeRange.from_strings("2020-01-01", "2020-01-31"),
        "area": AreaBBox.from_sequence([6.22, 80.41, 5.91, 80.64]),
        "frequency": "daily",
    }
    payload.update(overrides)
    return FetchRequest(**payload)


def test_daily_can_be_satisfied_from_hourly() -> None:
    req = _base_request()
    capability, _ = validate_request(req, DEFAULT_CATALOG)
    assert resolve_source_frequency(capability, req.frequency) == "hourly"


def test_unknown_variable_fails() -> None:
    req = _base_request(variables=["not_a_real_variable"])
    with pytest.raises(ValidationError):
        validate_request(req, DEFAULT_CATALOG)

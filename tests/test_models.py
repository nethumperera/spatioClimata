import pytest

from spatioclimata.exceptions import ValidationError
from spatioclimata.models import AreaBBox, TimeRange


def test_area_bbox_sequence() -> None:
    area = AreaBBox.from_sequence([6.22, 80.41, 5.91, 80.64])
    assert area.as_list() == [6.22, 80.41, 5.91, 80.64]


def test_area_bbox_invalid_lat_order() -> None:
    with pytest.raises(ValidationError):
        AreaBBox(north=1.0, west=10.0, south=2.0, east=11.0)


def test_time_range_month_iteration() -> None:
    tr = TimeRange.from_strings("2020-01-15", "2020-03-02")
    assert tr.iter_months() == [(2020, 1), (2020, 2), (2020, 3)]
    assert tr.days_for_month(2020, 1)[0] == "15"
    assert tr.days_for_month(2020, 3)[-1] == "02"

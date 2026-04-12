import numpy as np
import pandas as pd
import xarray as xr

from spatioclimata.models import AreaBBox
from spatioclimata.transforms import resample_to_frequency, subset_area


def _sample_dataset() -> xr.Dataset:
    time = pd.date_range("2020-01-01", periods=24, freq="h")
    lat = np.array([6.25, 6.0, 5.75])
    lon = np.array([80.25, 80.5, 80.75])
    data = np.random.rand(24, 3, 3)
    return xr.Dataset(
        data_vars={"total_precipitation": (("time", "latitude", "longitude"), data)},
        coords={"time": time, "latitude": lat, "longitude": lon},
    )


def test_daily_resample() -> None:
    ds = _sample_dataset()
    out = resample_to_frequency(ds, "daily")
    assert out.sizes["time"] == 1


def test_subset_area() -> None:
    ds = _sample_dataset()
    area = AreaBBox.from_sequence([6.2, 80.2, 5.8, 80.6])
    out = subset_area(ds, area)
    assert out.sizes["latitude"] <= ds.sizes["latitude"]
    assert out.sizes["longitude"] <= ds.sizes["longitude"]

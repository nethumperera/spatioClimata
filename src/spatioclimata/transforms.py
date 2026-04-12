"""Transformation helpers for analytics-ready outputs."""

from __future__ import annotations

import numpy as np
import xarray as xr

from .exceptions import ProcessingError
from .models import AreaBBox, Frequency


def normalize_coords(ds: xr.Dataset) -> xr.Dataset:
    """Normalize common Copernicus coordinate names to time/latitude/longitude."""
    if "time" not in ds.coords:
        for candidate in ("valid_time", "forecast_time"):
            if candidate in ds.coords:
                ds = ds.rename({candidate: "time"})
                break
        else:
            for name, coord in ds.coords.items():
                dtype = getattr(coord, "dtype", None)
                if dtype is not None and np.issubdtype(dtype, np.datetime64):
                    ds = ds.rename({name: "time"})
                    break

    rename_dict: dict[str, str] = {}
    if "lat" in ds.coords and "latitude" not in ds.coords:
        rename_dict["lat"] = "latitude"
    if "lon" in ds.coords and "longitude" not in ds.coords:
        rename_dict["lon"] = "longitude"
    if rename_dict:
        ds = ds.rename(rename_dict)

    return ds


def subset_area(ds: xr.Dataset, area: AreaBBox | None) -> xr.Dataset:
    if area is None:
        return ds

    lat_name = "latitude" if "latitude" in ds.coords else None
    lon_name = "longitude" if "longitude" in ds.coords else None

    if lat_name is None or lon_name is None:
        return ds

    lats = ds[lat_name].values
    lons = ds[lon_name].values

    lat_slice = slice(area.north, area.south) if lats[0] > lats[-1] else slice(area.south, area.north)
    lon_slice = slice(area.west, area.east) if lons[0] <= lons[-1] else slice(area.east, area.west)

    return ds.sel({lat_name: lat_slice, lon_name: lon_slice})


def resample_to_frequency(ds: xr.Dataset, target: Frequency) -> xr.Dataset:
    if target == "hourly":
        return ds

    if "time" not in ds.coords:
        raise ProcessingError("Cannot resample dataset without a time coordinate")

    if target == "daily":
        return ds.resample(time="1D").mean(dim="time", keep_attrs=True)
    if target == "monthly":
        return ds.resample(time="1MS").mean(dim="time", keep_attrs=True)

    raise ProcessingError(f"Unsupported target frequency: {target}")


def merge_on_primary_grid(primary: xr.Dataset, secondary: xr.Dataset, method: str = "nearest") -> xr.Dataset:
    """Regrid secondary dataset to primary grid and merge variables."""
    left = normalize_coords(primary)
    right = normalize_coords(secondary)

    if "time" in left.coords and "time" in right.coords:
        left["time"] = left["time"].dt.floor("D")
        right["time"] = right["time"].dt.floor("D")

    right_interp = right.interp_like(left, method=method)
    return xr.merge([left, right_interp], compat="override")

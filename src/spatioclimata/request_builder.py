"""Request assembly utilities for Copernicus datasets."""

from __future__ import annotations

from .catalog import DatasetCapability
from .models import FetchRequest, Frequency

_HOURS_24 = [f"{h:02d}:00" for h in range(24)]


def month_token(year: int, month: int) -> str:
    return f"{year}_{month:02d}"


def build_monthly_request(
    request: FetchRequest,
    capability: DatasetCapability,
    year: int,
    month: int,
    source_frequency: Frequency,
) -> dict:
    """Build a monthly request payload according to dataset conventions."""
    days = request.time_range.days_for_month(year, month)
    if not days:
        return {}

    params = dict(capability.default_params)
    params.update(request.extra_params)

    year_key = f"{capability.date_prefix}year"
    month_key = f"{capability.date_prefix}month"
    day_key = f"{capability.date_prefix}day"

    params[year_key] = str(year)
    params[month_key] = f"{month:02d}"
    params[day_key] = days
    params["variable"] = request.variables
    params["format"] = request.fmt

    if capability.supports_time and source_frequency == "hourly":
        params.setdefault("time", _HOURS_24)

    if request.area is not None and capability.supports_area:
        params["area"] = request.area.as_list()

    if request.grid is not None and capability.supports_grid:
        params["grid"] = [request.grid[0], request.grid[1]]

    # GloFAS historical commonly uses consolidated for older periods.
    if request.dataset == "cems-glofas-historical" and "product_type" not in request.extra_params:
        params["product_type"] = "consolidated" if year < 2024 else "intermediate"

    return params

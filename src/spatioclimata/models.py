"""Core data models used across the package."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Literal

from .exceptions import ValidationError

Frequency = Literal["hourly", "daily", "monthly"]
MergeStrategy = Literal["none", "monthly", "yearly"]


@dataclass(frozen=True)
class AreaBBox:
    """Bounding box in Copernicus order: [North, West, South, East]."""

    north: float
    west: float
    south: float
    east: float

    def __post_init__(self) -> None:
        if self.north < self.south:
            raise ValidationError("north must be >= south")
        if not (-90 <= self.south <= 90 and -90 <= self.north <= 90):
            raise ValidationError("Latitude must be within [-90, 90]")
        if not (-180 <= self.west <= 180 and -180 <= self.east <= 180):
            raise ValidationError("Longitude must be within [-180, 180]")

    @classmethod
    def from_sequence(cls, values: Sequence[float]) -> AreaBBox:
        if len(values) != 4:
            raise ValidationError("Area must have exactly 4 values: north,west,south,east")
        return cls(float(values[0]), float(values[1]), float(values[2]), float(values[3]))

    def as_list(self) -> list[float]:
        return [self.north, self.west, self.south, self.east]


@dataclass(frozen=True)
class TimeRange:
    """Inclusive time range."""

    start: date
    end: date

    def __post_init__(self) -> None:
        if self.end < self.start:
            raise ValidationError("end date must be >= start date")

    @classmethod
    def from_strings(cls, start: str, end: str, fmt: str = "%Y-%m-%d") -> TimeRange:
        start_d = datetime.strptime(start, fmt).date()
        end_d = datetime.strptime(end, fmt).date()
        return cls(start=start_d, end=end_d)

    def iter_months(self) -> list[tuple[int, int]]:
        """Return all year/month tuples inside the range."""
        year = self.start.year
        month = self.start.month
        months: list[tuple[int, int]] = []

        while (year, month) <= (self.end.year, self.end.month):
            months.append((year, month))
            if month == 12:
                year += 1
                month = 1
            else:
                month += 1
        return months

    def days_for_month(self, year: int, month: int) -> list[str]:
        """Return valid day numbers for a month constrained to start/end boundaries."""
        if (year, month) < (self.start.year, self.start.month) or (year, month) > (
            self.end.year,
            self.end.month,
        ):
            return []

        month_start = 1
        month_end = 31

        if year == self.start.year and month == self.start.month:
            month_start = self.start.day
        if year == self.end.year and month == self.end.month:
            month_end = self.end.day

        return [f"{d:02d}" for d in range(month_start, month_end + 1)]


@dataclass
class FetchRequest:
    """User request model for a dataset retrieval run."""

    dataset: str
    variables: list[str]
    time_range: TimeRange
    area: AreaBBox | None = None
    frequency: Frequency = "daily"
    output_dir: str | Path = "./outputs"
    merge_strategy: MergeStrategy = "yearly"
    grid: tuple[float, float] | None = None
    fmt: str = "netcdf"
    extra_params: dict[str, Any] = field(default_factory=dict)
    overwrite: bool = False
    use_dask: bool = False
    chunks: dict[str, int] | None = None

    def __post_init__(self) -> None:
        if not self.dataset:
            raise ValidationError("dataset is required")
        if not self.variables:
            raise ValidationError("At least one variable is required")
        self.variables = [v.strip() for v in self.variables if v.strip()]
        if not self.variables:
            raise ValidationError("At least one non-empty variable is required")

        if self.grid is not None:
            if len(self.grid) != 2:
                raise ValidationError("grid must have two values: lat_res, lon_res")
            if self.grid[0] <= 0 or self.grid[1] <= 0:
                raise ValidationError("grid resolution values must be positive")

        self.output_dir = str(self.output_dir)


@dataclass
class FetchResult:
    """Pipeline output summary."""

    request: FetchRequest
    downloaded_files: list[str]
    processed_files: list[str]
    saved_files: list[str]
    warnings: list[str] = field(default_factory=list)

"""Dataset registry and capability metadata."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from .exceptions import CatalogError
from .models import Frequency

APIType = Literal["cds", "ewds"]


@dataclass(frozen=True)
class DatasetCapability:
    """Capabilities and request defaults for a Copernicus dataset."""

    dataset_id: str
    api: APIType
    description: str
    native_frequencies: tuple[Frequency, ...]
    known_variables: tuple[str, ...] | None = None
    default_params: dict[str, Any] = field(default_factory=dict)
    date_prefix: str = ""
    supports_area: bool = True
    supports_grid: bool = False
    supports_time: bool = False


class DatasetCatalog:
    """In-memory dataset registry."""

    def __init__(self) -> None:
        self._registry: dict[str, DatasetCapability] = {}

    def register(self, capability: DatasetCapability) -> None:
        self._registry[capability.dataset_id] = capability

    def get(self, dataset_id: str) -> DatasetCapability:
        try:
            return self._registry[dataset_id]
        except KeyError as exc:
            raise CatalogError(
                f"Unknown dataset '{dataset_id}'. Use list_datasets() to inspect available datasets."
            ) from exc

    def list_datasets(self) -> list[DatasetCapability]:
        return list(self._registry.values())

    def list_dataset_ids(self) -> list[str]:
        return sorted(self._registry.keys())


def build_default_catalog() -> DatasetCatalog:
    catalog = DatasetCatalog()

    catalog.register(
        DatasetCapability(
            dataset_id="reanalysis-era5-single-levels",
            api="cds",
            description="ERA5 hourly single-level reanalysis.",
            native_frequencies=("hourly",),
            supports_area=True,
            supports_grid=True,
            supports_time=True,
            default_params={
                "product_type": "reanalysis",
                "format": "netcdf",
            },
            known_variables=(
                "2m_temperature",
                "total_precipitation",
                "surface_runoff",
                "sub_surface_runoff",
                "volumetric_soil_water_layer_1",
                "potential_evaporation",
                "evaporation",
                "soil_temperature_level_1",
                "surface_pressure",
                "10m_u_component_of_wind",
                "10m_v_component_of_wind",
            ),
        )
    )

    catalog.register(
        DatasetCapability(
            dataset_id="derived-era5-single-levels-daily-statistics",
            api="cds",
            description="ERA5 daily statistics derived product.",
            native_frequencies=("daily",),
            supports_area=True,
            supports_grid=True,
            supports_time=False,
            default_params={
                "product_type": "reanalysis",
                "daily_statistic": "daily_mean",
                "time_zone": "utc+00:00",
                "frequency": "1_hourly",
                "format": "netcdf",
            },
            known_variables=(
                "2m_temperature",
                "total_precipitation",
                "surface_runoff",
                "sub_surface_runoff",
                "volumetric_soil_water_layer_1",
                "potential_evaporation",
                "surface_pressure",
            ),
        )
    )

    catalog.register(
        DatasetCapability(
            dataset_id="cems-glofas-historical",
            api="ewds",
            description="GloFAS historical daily discharge and related variables.",
            native_frequencies=("daily",),
            supports_area=True,
            supports_grid=False,
            supports_time=False,
            date_prefix="h",
            default_params={
                "system_version": "version_4_0",
                "hydrological_model": "lisflood",
                "format": "netcdf",
            },
            known_variables=(
                "river_discharge_in_the_last_24_hours",
                "soil_wetness_index",
                "runoff_water_equivalent",
            ),
        )
    )

    return catalog


DEFAULT_CATALOG = build_default_catalog()

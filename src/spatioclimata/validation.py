"""Validation and frequency planning logic."""

from __future__ import annotations

from .catalog import DatasetCapability, DatasetCatalog
from .exceptions import ValidationError
from .models import FetchRequest, Frequency


def _supports_frequency(capability: DatasetCapability, requested: Frequency) -> bool:
    native = set(capability.native_frequencies)
    if requested in native:
        return True
    if requested == "daily" and "hourly" in native:
        return True
    if requested == "monthly" and ("daily" in native or "hourly" in native):
        return True
    return False


def resolve_source_frequency(capability: DatasetCapability, requested: Frequency) -> Frequency:
    """Return the source frequency that must be downloaded to satisfy the requested output."""
    native = set(capability.native_frequencies)
    if requested in native:
        return requested
    if requested == "daily" and "hourly" in native:
        return "hourly"
    if requested == "monthly":
        if "daily" in native:
            return "daily"
        if "hourly" in native:
            return "hourly"
    raise ValidationError(
        f"Dataset '{capability.dataset_id}' cannot satisfy requested frequency '{requested}'"
    )


def validate_request(request: FetchRequest, catalog: DatasetCatalog) -> tuple[DatasetCapability, list[str]]:
    capability = catalog.get(request.dataset)
    warnings: list[str] = []

    if not _supports_frequency(capability, request.frequency):
        raise ValidationError(
            f"Dataset '{request.dataset}' does not support requested frequency '{request.frequency}'. "
            f"Native frequencies: {capability.native_frequencies}"
        )

    if capability.known_variables is not None:
        unknown = sorted(set(request.variables) - set(capability.known_variables))
        if unknown:
            raise ValidationError(
                "Unsupported variables for dataset "
                f"'{request.dataset}': {unknown}. Use list_variables(dataset) to inspect supported values."
            )
    else:
        warnings.append(
            "Dataset variable catalog is not strictly defined. Request will be sent as-is to Copernicus API."
        )

    if request.area is None and capability.supports_area:
        warnings.append(
            "No area was provided. Full spatial domain may be downloaded, which can be very large."
        )

    return capability, warnings

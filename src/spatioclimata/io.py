"""I/O helpers for robust NetCDF access."""

from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

import xarray as xr

from .exceptions import ProcessingError
from .transforms import normalize_coords


def open_dataset_with_fallback(path: str | Path, chunks: dict[str, int] | None = None) -> xr.Dataset:
    """Open a single dataset with backend fallback and coordinate normalization."""
    dataset_path = str(path)
    last_error: Exception | None = None

    for engine in ("netcdf4", "h5netcdf", "scipy"):
        try:
            kwargs = {"engine": engine}
            if chunks:
                kwargs["chunks"] = chunks
            ds = xr.open_dataset(dataset_path, **kwargs)
            return normalize_coords(ds)
        except Exception as exc:  # pragma: no cover
            last_error = exc

    raise ProcessingError(
        f"Unable to open dataset '{dataset_path}' with netcdf4/h5netcdf/scipy. "
        f"Last error: {last_error}"
    )


def open_mfdataset_with_fallback(
    paths: list[str | Path],
    chunks: dict[str, int] | None = None,
) -> xr.Dataset:
    """Open one or multiple datasets with backend fallback."""
    file_paths = [str(p) for p in paths]
    if not file_paths:
        raise ProcessingError("No file paths provided to open_mfdataset_with_fallback")

    if len(file_paths) == 1:
        return open_dataset_with_fallback(file_paths[0], chunks=chunks)

    last_error: Exception | None = None
    for engine in ("netcdf4", "h5netcdf", "scipy"):
        try:
            ds = xr.open_mfdataset(
                file_paths,
                combine="by_coords",
                engine=engine,
                parallel=bool(chunks),
                chunks=chunks,
                data_vars="minimal",
                coords="minimal",
                compat="override",
            )
            return normalize_coords(ds)
        except Exception as exc:  # pragma: no cover
            last_error = exc

    raise ProcessingError(
        "Unable to open multiple datasets with netcdf4/h5netcdf/scipy. "
        f"Last error: {last_error}"
    )


def prepare_month_nc_files(raw_file: str | Path, extract_dir: str | Path) -> list[str]:
    """Return NetCDF paths from a raw monthly file, including ZIP extraction if needed."""
    raw_path = Path(raw_file)
    if not raw_path.exists():
        return []

    if not zipfile.is_zipfile(raw_path):
        return [str(raw_path)]

    extract_path = Path(extract_dir)
    extract_path.mkdir(parents=True, exist_ok=True)

    existing = sorted(str(p) for p in extract_path.glob("*.nc"))
    if existing:
        return existing

    with zipfile.ZipFile(raw_path, "r") as archive:
        members = [name for name in archive.namelist() if name.lower().endswith(".nc")]
        if not members:
            return []
        archive.extractall(path=extract_path, members=members)

    return sorted(str(p) for p in extract_path.glob("*.nc"))


def cleanup_extract_dir(extract_dir: str | Path) -> None:
    path = Path(extract_dir)
    if path.exists():
        shutil.rmtree(path)

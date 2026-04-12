"""End-to-end data engineering pipeline for spatioClimata."""

from __future__ import annotations

import time
from pathlib import Path

from .auth import CopernicusClients, build_clients
from .catalog import DEFAULT_CATALOG, DatasetCatalog
from .exceptions import DownloadError, ProcessingError
from .io import cleanup_extract_dir, open_mfdataset_with_fallback, prepare_month_nc_files
from .models import FetchRequest, FetchResult
from .request_builder import build_monthly_request
from .transforms import resample_to_frequency, subset_area
from .validation import resolve_source_frequency, validate_request


def _dataset_slug(dataset_id: str) -> str:
    return dataset_id.replace("-", "_")


def _source_ext(fmt: str) -> str:
    return "grib" if fmt.lower() == "grib" else "nc"


def _choose_client(clients: CopernicusClients, api: str):
    return clients.cds if api == "cds" else clients.ewds


def _resolve_chunks(request: FetchRequest) -> dict[str, int] | None:
    if not request.use_dask:
        return None

    try:
        import dask  # noqa: F401
    except ImportError as exc:  # pragma: no cover
        raise ProcessingError(
            "Dask mode requested, but dask is not installed. Install with: pip install 'spatioClimata[dask]'"
        ) from exc

    return request.chunks or {"time": 240}


def retrieve_with_retry(
    client,
    dataset: str,
    payload: dict,
    target_file: str,
    max_retries: int = 3,
    initial_backoff_seconds: float = 10.0,
) -> None:
    """Execute a robust download with exponential backoff."""
    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            client.retrieve(dataset, payload, target_file)
            return
        except Exception as exc:  # pragma: no cover
            last_error = exc
            if attempt < max_retries - 1:
                wait_s = initial_backoff_seconds * (2**attempt)
                time.sleep(wait_s)

    raise DownloadError(
        f"Failed to download dataset '{dataset}' after {max_retries} attempts. Last error: {last_error}"
    )


def run_pipeline(
    request: FetchRequest,
    catalog: DatasetCatalog = DEFAULT_CATALOG,
    clients: CopernicusClients | None = None,
    open_browser_on_missing_key: bool = False,
    interactive_on_missing_key: bool = False,
    max_retries: int = 3,
) -> FetchResult:
    """Run a complete dataset retrieval and transformation workflow."""
    capability, warnings = validate_request(request, catalog)
    source_frequency = resolve_source_frequency(capability, request.frequency)
    chunks = _resolve_chunks(request)

    if clients is None:
        clients = build_clients(
            open_browser_on_missing_key=open_browser_on_missing_key,
            interactive_on_missing_key=interactive_on_missing_key,
        )

    output_dir = Path(request.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    dataset_slug = _dataset_slug(request.dataset)
    client = _choose_client(clients, capability.api)

    downloaded_files: list[str] = []
    processed_files: list[str] = []
    saved_files: list[str] = []
    monthly_by_year: dict[int, list[str]] = {}

    for year, month in request.time_range.iter_months():
        payload = build_monthly_request(request, capability, year, month, source_frequency)
        if not payload:
            continue

        raw_file = output_dir / (
            f"{dataset_slug}_raw_{source_frequency}_{year}_{month:02d}.{_source_ext(request.fmt)}"
        )

        if request.overwrite or not raw_file.exists():
            retrieve_with_retry(
                client=client,
                dataset=request.dataset,
                payload=payload,
                target_file=str(raw_file),
                max_retries=max_retries,
            )

        downloaded_files.append(str(raw_file))

        needs_processing = (
            request.frequency != source_frequency
            or request.area is not None
            or request.merge_strategy in {"monthly", "yearly"}
        )

        if not needs_processing:
            continue

        processed_file = output_dir / f"{dataset_slug}_{request.frequency}_{year}_{month:02d}.nc"
        if not request.overwrite and processed_file.exists():
            processed_files.append(str(processed_file))
            monthly_by_year.setdefault(year, []).append(str(processed_file))
            continue

        extract_dir = output_dir / f"_extract_{dataset_slug}_{year}_{month:02d}"

        ds_source = None
        ds_processed = None
        try:
            nc_files = prepare_month_nc_files(raw_file, extract_dir)
            if not nc_files:
                raise ProcessingError(f"No NetCDF payload found in file: {raw_file}")

            ds_source = open_mfdataset_with_fallback(nc_files, chunks=chunks)
            ds_processed = ds_source

            if request.area is not None:
                ds_processed = subset_area(ds_processed, request.area)

            if source_frequency != request.frequency:
                ds_processed = resample_to_frequency(ds_processed, request.frequency)
            elif request.frequency == "daily" and "time" in ds_processed.coords:
                ds_processed["time"] = ds_processed["time"].dt.floor("D")

            if "time" in ds_processed.coords:
                ds_processed = ds_processed.sortby("time")

            ds_processed.to_netcdf(str(processed_file), engine="netcdf4")
            processed_files.append(str(processed_file))
            monthly_by_year.setdefault(year, []).append(str(processed_file))

        except Exception as exc:
            raise ProcessingError(
                f"Failed to process month {year}-{month:02d} for dataset '{request.dataset}': {exc}"
            ) from exc
        finally:
            if ds_processed is not None and ds_processed is not ds_source:
                ds_processed.close()
            if ds_source is not None:
                ds_source.close()
            cleanup_extract_dir(extract_dir)

    if request.merge_strategy == "yearly":
        for year, monthly_files in sorted(monthly_by_year.items()):
            yearly_file = output_dir / f"{dataset_slug}_{request.frequency}_{year}.nc"
            if not request.overwrite and yearly_file.exists():
                saved_files.append(str(yearly_file))
                continue

            ds_year = None
            try:
                ds_year = open_mfdataset_with_fallback(monthly_files, chunks=chunks)
                if "time" in ds_year.coords:
                    ds_year = ds_year.sortby("time")
                ds_year.to_netcdf(str(yearly_file), engine="netcdf4")
                saved_files.append(str(yearly_file))
            except Exception as exc:
                raise ProcessingError(
                    f"Failed yearly merge for {year} in dataset '{request.dataset}': {exc}"
                ) from exc
            finally:
                if ds_year is not None:
                    ds_year.close()
    elif processed_files:
        saved_files = processed_files
    else:
        saved_files = downloaded_files

    return FetchResult(
        request=request,
        downloaded_files=downloaded_files,
        processed_files=processed_files,
        saved_files=saved_files,
        warnings=warnings,
    )

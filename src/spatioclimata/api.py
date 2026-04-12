"""Public programmatic API."""

from __future__ import annotations

from .auth import init_auth as _init_auth
from .catalog import DEFAULT_CATALOG, DatasetCatalog
from .models import FetchRequest, FetchResult
from .pipeline import run_pipeline


def list_datasets(catalog: DatasetCatalog = DEFAULT_CATALOG) -> list[dict[str, object]]:
    """List known datasets and capabilities."""
    rows: list[dict[str, object]] = []
    for item in catalog.list_datasets():
        rows.append(
            {
                "dataset": item.dataset_id,
                "api": item.api,
                "native_frequencies": list(item.native_frequencies),
                "known_variable_count": 0 if item.known_variables is None else len(item.known_variables),
                "description": item.description,
            }
        )
    return rows


def list_variables(dataset: str, catalog: DatasetCatalog = DEFAULT_CATALOG) -> list[str]:
    """List known variables for a dataset."""
    capability = catalog.get(dataset)
    if capability.known_variables is None:
        return []
    return sorted(capability.known_variables)


def list_frequencies(dataset: str, catalog: DatasetCatalog = DEFAULT_CATALOG) -> list[str]:
    """List native frequencies for a dataset."""
    capability = catalog.get(dataset)
    return list(capability.native_frequencies)


def init_auth(
    api_key: str | None = None,
    open_browser: bool = False,
    interactive: bool = True,
) -> str:
    """Initialize and persist credentials, returning a masked key."""
    return _init_auth(api_key=api_key, open_browser=open_browser, interactive=interactive)


def fetch(
    request: FetchRequest,
    catalog: DatasetCatalog = DEFAULT_CATALOG,
    open_browser_on_missing_key: bool = False,
    interactive_on_missing_key: bool = False,
    max_retries: int = 3,
) -> FetchResult:
    """Run an end-to-end fetch and processing pipeline."""
    return run_pipeline(
        request=request,
        catalog=catalog,
        open_browser_on_missing_key=open_browser_on_missing_key,
        interactive_on_missing_key=interactive_on_missing_key,
        max_retries=max_retries,
    )

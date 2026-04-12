"""spatioClimata public API."""

from .api import fetch, init_auth, list_datasets, list_frequencies, list_variables
from .models import AreaBBox, FetchRequest, FetchResult, TimeRange

__all__ = [
    "AreaBBox",
    "TimeRange",
    "FetchRequest",
    "FetchResult",
    "list_datasets",
    "list_variables",
    "list_frequencies",
    "init_auth",
    "fetch",
]

__version__ = "0.1.0"

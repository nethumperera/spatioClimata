"""Custom exceptions for spatioClimata."""


class SpatioClimataError(Exception):
    """Base package error."""


class CredentialError(SpatioClimataError):
    """Raised when credentials are missing or invalid."""


class CatalogError(SpatioClimataError):
    """Raised when a dataset is not found or improperly configured."""


class ValidationError(SpatioClimataError):
    """Raised when user request parameters fail validation."""


class DownloadError(SpatioClimataError):
    """Raised when a dataset retrieval repeatedly fails."""


class ProcessingError(SpatioClimataError):
    """Raised when transformation/merge operations fail."""

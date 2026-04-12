# Contributing to spatioClimata

Thank you for contributing.

## Development Setup

1. Clone the repository.
2. Create a virtual environment.
3. Install dependencies:

```bash
pip install -e ".[dev,dask]"
```

4. Run tests:

```bash
pytest
```

5. Run linting:

```bash
ruff check src tests
```

## Pull Request Guidelines

- Keep PRs focused on one feature or fix.
- Add or update tests for behavior changes.
- Update documentation when user-facing behavior changes.
- Keep public APIs backward-compatible when possible.

## Commit Style

Use clear, action-oriented commit messages.

Examples:

- `Add GloFAS request builder for daily runs`
- `Fix time coordinate normalization for EWDS responses`

## Reporting Bugs

When opening an issue, include:

- Python version
- Package version
- Command or code snippet
- Full traceback
- Expected and actual behavior

"""Command line interface for spatioClimata."""

from __future__ import annotations

import typer

from .api import fetch, init_auth, list_datasets, list_frequencies, list_variables
from .exceptions import SpatioClimataError
from .models import AreaBBox, FetchRequest, TimeRange

app = typer.Typer(help="spatioClimata CLI")
auth_app = typer.Typer(help="Authentication commands")
datasets_app = typer.Typer(help="Dataset discovery commands")

app.add_typer(auth_app, name="auth")
app.add_typer(datasets_app, name="datasets")


def _parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _parse_area(area: str | None) -> AreaBBox | None:
    if not area:
        return None
    parts = [float(x.strip()) for x in area.split(",")]
    return AreaBBox.from_sequence(parts)


def _parse_grid(grid: str | None) -> tuple[float, float] | None:
    if not grid:
        return None
    parts = [float(x.strip()) for x in grid.split(",")]
    if len(parts) != 2:
        raise ValueError("Grid must have two values: lat_res,lon_res")
    return (parts[0], parts[1])


def _parse_chunks(chunks: str | None) -> dict[str, int] | None:
    if not chunks:
        return None
    payload: dict[str, int] = {}
    for token in chunks.split(","):
        token = token.strip()
        if not token:
            continue
        key, raw_value = token.split("=", maxsplit=1)
        payload[key.strip()] = int(raw_value.strip())
    return payload or None


@auth_app.command("init")
def auth_init(
    open_browser: bool = typer.Option(False, help="Open Copernicus signup/API pages in browser."),
    api_key: str | None = typer.Option(None, help="API key to save directly."),
) -> None:
    """Initialize credentials."""
    try:
        masked = init_auth(api_key=api_key, open_browser=open_browser, interactive=True)
        typer.secho(f"Credentials saved successfully: {masked}", fg=typer.colors.GREEN)
    except SpatioClimataError as exc:
        typer.secho(str(exc), fg=typer.colors.RED)
        raise typer.Exit(code=1) from exc


@datasets_app.command("list")
def datasets_list() -> None:
    """List known datasets."""
    rows = list_datasets()
    for row in rows:
        typer.echo(
            f"- {row['dataset']} ({row['api']}) | native: {','.join(row['native_frequencies'])} "
            f"| vars: {row['known_variable_count']}"
        )
        typer.echo(f"  {row['description']}")


@datasets_app.command("variables")
def datasets_variables(dataset: str = typer.Argument(..., help="Dataset identifier")) -> None:
    """List known variables for a dataset."""
    try:
        values = list_variables(dataset)
        if not values:
            typer.echo("No strict variable list registered for this dataset.")
            return
        for item in values:
            typer.echo(f"- {item}")
    except SpatioClimataError as exc:
        typer.secho(str(exc), fg=typer.colors.RED)
        raise typer.Exit(code=1) from exc


@datasets_app.command("frequencies")
def datasets_frequencies(dataset: str = typer.Argument(..., help="Dataset identifier")) -> None:
    """List native frequencies for a dataset."""
    try:
        values = list_frequencies(dataset)
        for item in values:
            typer.echo(f"- {item}")
    except SpatioClimataError as exc:
        typer.secho(str(exc), fg=typer.colors.RED)
        raise typer.Exit(code=1) from exc


@app.command("fetch")
def fetch_command(
    dataset: str = typer.Option(..., help="Copernicus dataset id"),
    variables: str = typer.Option(..., help="Comma-separated variable list"),
    start: str = typer.Option(..., help="Start date, format YYYY-MM-DD"),
    end: str = typer.Option(..., help="End date, format YYYY-MM-DD"),
    area: str | None = typer.Option(
        None,
        help="Bounding box north,west,south,east",
    ),
    frequency: str = typer.Option("daily", help="Requested output frequency"),
    output_dir: str = typer.Option("./outputs", help="Output directory"),
    merge_strategy: str = typer.Option("yearly", help="none|monthly|yearly"),
    grid: str | None = typer.Option(None, help="Grid resolution lat_res,lon_res"),
    fmt: str = typer.Option("netcdf", help="Source format: netcdf|grib"),
    overwrite: bool = typer.Option(False, help="Overwrite existing outputs"),
    use_dask: bool = typer.Option(False, help="Enable Dask chunked processing"),
    chunks: str | None = typer.Option(None, help="Chunk map, ex: time=240,latitude=32"),
    open_browser_on_missing_key: bool = typer.Option(
        False, help="Open credential pages if key is missing"
    ),
    interactive_on_missing_key: bool = typer.Option(
        True, help="Prompt for credentials if key is missing"
    ),
    max_retries: int = typer.Option(3, help="Maximum download retry attempts"),
) -> None:
    """Run an end-to-end retrieval pipeline."""
    try:
        request = FetchRequest(
            dataset=dataset,
            variables=_parse_csv(variables),
            time_range=TimeRange.from_strings(start, end),
            area=_parse_area(area),
            frequency=frequency,  # type: ignore[arg-type]
            output_dir=output_dir,
            merge_strategy=merge_strategy,  # type: ignore[arg-type]
            grid=_parse_grid(grid),
            fmt=fmt,
            overwrite=overwrite,
            use_dask=use_dask,
            chunks=_parse_chunks(chunks),
        )

        result = fetch(
            request=request,
            open_browser_on_missing_key=open_browser_on_missing_key,
            interactive_on_missing_key=interactive_on_missing_key,
            max_retries=max_retries,
        )

        typer.secho("Pipeline completed.", fg=typer.colors.GREEN)
        if result.warnings:
            typer.secho("Warnings:", fg=typer.colors.YELLOW)
            for warning in result.warnings:
                typer.echo(f"- {warning}")

        typer.echo(f"Downloaded files: {len(result.downloaded_files)}")
        typer.echo(f"Processed files: {len(result.processed_files)}")
        typer.echo(f"Final outputs: {len(result.saved_files)}")
        for path in result.saved_files:
            typer.echo(f"- {path}")

    except (SpatioClimataError, ValueError) as exc:
        typer.secho(str(exc), fg=typer.colors.RED)
        raise typer.Exit(code=1) from exc


if __name__ == "__main__":
    app()

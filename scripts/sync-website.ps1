Param(
    [string]$SourcePath = "d:\1 -  Research\spatioClimata Web",
    [string]$TargetPath = ".\website"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SourcePath)) {
    throw "Source path not found: $SourcePath"
}

New-Item -ItemType Directory -Force -Path $TargetPath | Out-Null

Get-ChildItem -Path $TargetPath -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $SourcePath "*") -Destination $TargetPath -Recurse -Force

Write-Host "Website synced to $TargetPath"

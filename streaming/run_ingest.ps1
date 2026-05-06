param(
    [string]$Variable = ""
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot

$python = "C:/Users/HP/Documents/Programming/code/Scripts/python.exe"

if ($Variable -ne "") {
    & $python "ingest.py" --variable $Variable
} else {
    # Run all variables from config sequentially
    $config = Get-Content "config.json" | ConvertFrom-Json
    foreach ($var in $config.variables) {
        Write-Host "--- Ingesting: $var ---"
        & $python "ingest.py" --variable $var
    }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot

$python = "C:/Users/HP/Documents/Programming/code/Scripts/python.exe"
& $python "ingest.py"

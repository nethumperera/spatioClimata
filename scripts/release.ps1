Param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
    throw "This folder is not a git repository. Run scripts/bootstrap-repo.ps1 first."
}

$tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }

git add .
git commit -m "Prepare $tag release"

$tagExists = git tag --list $tag
if ($tagExists) {
    throw "Tag $tag already exists."
}

git tag $tag
git push origin main
git push origin $tag

Write-Host "Release pushed: $tag"
Write-Host "PyPI workflow and Pages workflow should start on GitHub."

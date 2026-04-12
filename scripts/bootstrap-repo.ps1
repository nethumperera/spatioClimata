Param(
    [string]$RemoteUrl = "https://github.com/nethumperera/spatioClimata.git",
    [string]$UserName = "Nethum Perera",
    [string]$UserEmail = "nethumsemithaperera@gmail.com"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
    git init
}

git branch -M main
git config user.name "$UserName"
git config user.email "$UserEmail"

$existingRemote = git remote
if ($existingRemote -notcontains "origin") {
    git remote add origin $RemoteUrl
} else {
    git remote set-url origin $RemoteUrl
}

Write-Host "Repository bootstrapped."
Write-Host "Next: git add . ; git commit -m 'Initial commit' ; git push -u origin main"

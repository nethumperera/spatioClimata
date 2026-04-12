# Release and Deployment Guide

This guide covers first-time git setup, initial push, package release, and website deployment.

## 1. Initialize Git and Connect Remote

Run from repository root (`spatioClimata`):

```powershell
git init
git branch -M main
git config user.name "Nethum Perera"
git config user.email "nethumsemithaperera@gmail.com"
git remote add origin https://github.com/nethumperera/spatioClimata.git
```

## 2. First Commit and Push

```powershell
git add .
git commit -m "Initial spatioClimata package, docs, and website"
git push -u origin main
```

## 3. Configure GitHub Pages

In repository settings:

1. Open Settings -> Pages.
2. Under Build and deployment, set Source to GitHub Actions.
3. Save settings.

The workflow `.github/workflows/deploy-pages.yml` will publish `website/` on pushes to `main`.

## 4. Configure PyPI Publishing

Preferred method: Trusted Publishing

1. On PyPI, create project `spatioClimata` if not already created.
2. In PyPI project settings, add a Trusted Publisher:
   - Owner: `nethumperera`
   - Repository: `spatioClimata`
   - Workflow: `publish-pypi.yml`
   - Environment (optional but recommended): `pypi`
3. In GitHub, create environment `pypi` (Settings -> Environments).

Alternative method: API token

1. Create `PYPI_API_TOKEN` repository secret.
2. In `.github/workflows/publish-pypi.yml`, uncomment the `with.password` block.

## 5. Create and Publish a Release

```powershell
git add .
git commit -m "Prepare v0.1.0 release"
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

Tag push triggers `.github/workflows/publish-pypi.yml`.

## 6. Verify

- Package: https://pypi.org/project/spatioClimata/
- Website: https://nethumperera.github.io/spatioClimata/

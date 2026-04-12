# spatioClimata Web

Static website for the spatioClimata package.

## Structure

- `index.html`: landing page
- `pages/docs.html`: usage and command docs
- `pages/examples.html`: practical workflow examples
- `assets/css/style.css`: theme and layout styles
- `assets/js/main.js`: reveal animations and interaction helpers

## Run Locally

Option 1 using Python:

```bash
cd "d:\1 -  Research\spatioClimata Web"
python -m http.server 8080
```

Then open `http://localhost:8080`.

Option 2 using VS Code Live Server extension.

## Deploy

This is a static site and can be deployed to GitHub Pages, Netlify, or Azure Static Web Apps without build steps.

## Content Updates

- Keep package commands aligned with repository README.
- Update supported datasets/frequencies as package catalog evolves.

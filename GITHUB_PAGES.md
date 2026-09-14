# Deploy Trip Canvas to GitHub Pages

Trip Canvas is a client-side app. Trips, places, itineraries and bookings live in `localStorage`. There are no API keys and no required backend.

## This repository

- Source: `main`
- Built site: `gh-pages`
- Live URL after enabling Pages: https://girigurubilly.github.io/TripPlanner/

Enable once: **Settings → Pages → Branch: `gh-pages` / root**.

Pushes to `main` run `.github/workflows/github-pages.yml`, which builds with `VITE_BASE=/TripPlanner/` and publishes `_site` to `gh-pages`.

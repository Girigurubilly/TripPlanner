# Deploy Trip Canvas to GitHub Pages

Trip Canvas is a client-side app. Trips, places, itineraries and bookings live in `localStorage`. There are no API keys and no required backend.

## This repository

- Source: `main`
- Built site: `gh-pages`
- Live URL after enabling Pages: https://girigurubilly.github.io/TripPlanner/

Enable once: **Settings → Pages → Branch: `gh-pages` / root**.

Pushes to `main` run `.github/workflows/github-pages.yml`, which builds with
`GITHUB_PAGES=1` and `VITE_BASE=/TripPlanner/` (SPA shell + static assets) and
publishes `_site` to `gh-pages`.

The site is a static SPA: every route is served from `index.html` / `404.html`.
If a page looks blank after a deploy, wait for the Actions run to finish, then
hard-refresh.

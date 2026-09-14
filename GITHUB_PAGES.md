# Deploy Trip Canvas to GitHub Pages

Trip Canvas is a client-side app. Trips, places, itineraries and bookings live in `localStorage`. There are no API keys and no required backend.

The hosted Grok / Vercel build is the primary deploy. GitHub Pages can serve the same UI as a static site.

## Project site (`https://<user>.github.io/<repo>/`)

1. Set the Vite base path to your repository name:

   ```bash
   VITE_BASE=/<repo>/ npm run build
   ```

2. Publish the built client assets (Nitro/Vercel output includes a public directory after `npm run build`). Copy `public/404.html` and `public/.nojekyll` with the site so deep links such as `/trips/.../plan` fall back to the app.

3. `404.html` sends the original path to `?path=/…`. The app reads that query and restores the route.

## Actions sketch

Use GitHub Pages from Actions, with `VITE_BASE` matching the repository name. Enable Pages → GitHub Actions in the repo settings.

Short Google Maps links (`maps.app.goo.gl`) still cannot be resolved without a server-side Place API — paste a full maps URL that includes `@lat,lng` instead.

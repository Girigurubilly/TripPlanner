# Trip Canvas

Personal travel planner: turn a saved-place list into a realistic, map-based day-by-day itinerary. Everything stays in the browser (`localStorage`) until you export a backup. No API keys.

Repository: [github.com/Girigurubilly/TripPlanner](https://github.com/Girigurubilly/TripPlanner)

GitHub Pages URL (after enabling Pages below): [girigurubilly.github.io/TripPlanner](https://girigurubilly.github.io/TripPlanner/)

## Enable GitHub Pages (one time)

The built site is already on the `gh-pages` branch. In the repo:

1. Open [Settings → Pages](https://github.com/Girigurubilly/TripPlanner/settings/pages)
2. **Branch**: `gh-pages` / `/ (root)`
3. Save

The site is then at `https://girigurubilly.github.io/TripPlanner/`. Later pushes to `main` rebuild and update that branch.

## Features

- Multi-city trips with hotels, pace, and transport
- Destination search across cities **and ~7,900 world airports** (IATA)
- Time zone picker and time fields you can pick *or* type
- Places hub, drag-and-drop daily plan, daily map, bookings, insights
- English, 繁體中文, 简体中文, 日本語
- Delete any trip; JSON backup / restore

Airport catalogue is derived from [mwgg/Airports](https://github.com/mwgg/Airports) (OurAirports data). Time zones use the IANA list from the browser.

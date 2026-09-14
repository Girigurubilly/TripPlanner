# Trip Canvas

Personal travel planner: turn a saved-place list into a realistic, map-based day-by-day itinerary. Everything stays in the browser (`localStorage`) until you export a backup. No API keys.

Live on GitHub Pages: [girigurubilly.github.io/TripPlanner](https://girigurubilly.github.io/TripPlanner/)

## Features

- Multi-city trips with hotels, pace, and transport
- Destination search across cities **and ~7,900 world airports** (IATA)
- Time zone picker and time fields you can pick *or* type
- Places hub, drag-and-drop daily plan, daily map, bookings, insights
- English, 繁體中文, 简体中文, 日本語
- Delete any trip; JSON backup / restore

Airport catalogue is derived from [mwgg/Airports](https://github.com/mwgg/Airports) (OurAirports data). Time zones use the IANA list from the browser.

## GitHub Pages

The app is a client-side SPA. On push to `main`, GitHub Actions builds with `VITE_BASE=/TripPlanner/` and deploys.

Deep links fall back through `public/404.html` (`?path=/…`).

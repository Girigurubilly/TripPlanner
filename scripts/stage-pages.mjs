#!/usr/bin/env node
/**
 * Stage a static GitHub Pages site from the Vite/Nitro client assets.
 * TanStack Start's Vercel build is SSR; Pages needs an index.html + 404.html
 * that load the hashed client bundle.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const roots = [
  ".vercel/output/static",
  ".output/public",
  "dist/client",
  "dist",
];
const src = roots.find((dir) => existsSync(dir) && existsSync(join(dir, "assets")));
if (!src) {
  console.error("[pages] no client assets found — run npm run build first");
  process.exit(1);
}

const dest = process.argv[2] || "_site";
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

const assets = readdirSync(join(dest, "assets"));
const js = assets.find((f) => /^index-.*\.js$/.test(f));
const css = assets.find((f) => /^styles-.*\.css$/.test(f));
if (!js || !css) {
  console.error("[pages] missing index-*.js or styles-*.css in", join(dest, "assets"));
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#21564A" />
    <title>Trip Canvas</title>
    <meta name="description" content="Turn a saved-place checklist into a realistic, map-based day-by-day itinerary." />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <link rel="stylesheet" href="./assets/${css}" />
    <script type="module" src="./assets/${js}"></script>
  </head>
  <body></body>
</html>
`;

writeFileSync(join(dest, "index.html"), html);
writeFileSync(join(dest, "404.html"), html);
writeFileSync(join(dest, ".nojekyll"), "");
if (existsSync("public/data/airports.json")) {
  mkdirSync(join(dest, "data"), { recursive: true });
  cpSync("public/data/airports.json", join(dest, "data", "airports.json"));
}
console.log(`[pages] staged ${dest} (entry assets/${js})`);

#!/usr/bin/env node
/**
 * Stage a static GitHub Pages site from the Vite/Nitro client assets.
 * TanStack Start's Vercel build is SSR; Pages needs a prerendered SPA shell
 * (with window.$_TSR) as index.html + 404.html so client routes hydrate.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const roots = [
  ".vercel/output/static",
  ".output/public",
  "dist/client",
  "dist",
];
const src = roots.find((dir) => existsSync(dir) && existsSync(join(dir, "assets")));
if (!src) {
  console.error("[pages] no client assets found — run npm run build:pages first");
  process.exit(1);
}

const dest = process.argv[2] || "_site";
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

function findShell(dir) {
  const candidates = ["_shell.html", "index.html"];
  for (const name of candidates) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    const html = readFileSync(path, "utf8");
    if (html.includes("$_TSR") || html.includes("__TSS") || html.includes("<div id=")) {
      return { path, html };
    }
  }
  // Search one extra level (basepath-prefixed folders)
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "assets") continue;
    const nested = findShell(join(dir, entry.name));
    if (nested) return nested;
  }
  return null;
}

const shell = findShell(dest);
if (!shell) {
  console.error(
    "[pages] no prerendered SPA shell found. Build with GITHUB_PAGES=1 (npm run build:pages) so TanStack Start emits _shell.html.",
  );
  process.exit(1);
}

writeFileSync(join(dest, "index.html"), shell.html);
writeFileSync(join(dest, "404.html"), shell.html);
writeFileSync(join(dest, ".nojekyll"), "");
if (existsSync("public/data/airports.json")) {
  mkdirSync(join(dest, "data"), { recursive: true });
  cpSync("public/data/airports.json", join(dest, "data", "airports.json"));
}
console.log(`[pages] staged ${dest} from ${shell.path}`);

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const source = join(root, ".output/public");
const renderer = join(root, "node_modules/.nitro/prerender/index.mjs");
const target = join(root, "dist/pages");

if (!existsSync(join(source, "assets")) || !existsSync(renderer)) {
  console.error("[pages] static build did not produce assets");
  process.exit(1);
}

const mod = await import(pathToFileURL(renderer).href);
const response = await mod.default.fetch(new Request("http://localhost/TripPlanner/"));
const html = await response.text();
if (response.status !== 200 || !html.includes("/TripPlanner/assets/")) {
  console.error(`[pages] expected HTML for /TripPlanner/, got ${response.status}`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
rmSync(join(target, "index"), { force: true });
writeFileSync(join(target, "index.html"), html);
writeFileSync(join(target, "404.html"), html);
writeFileSync(join(target, ".nojekyll"), "");
console.log(`[pages] static site ready at ${target}`);

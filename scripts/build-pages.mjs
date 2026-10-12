import { spawn } from "node:child_process";

const child = spawn("node", ["scripts/with-app-env.mjs", "vite", "build"], {
  env: { ...process.env, GITHUB_PAGES: "1" },
  stdio: "inherit",
});

child.on("exit", (code) => {
  const prepare = spawn("node", ["scripts/prepare-pages.mjs"], { stdio: "inherit" });
  prepare.on("exit", (prepareCode) => {
    if (prepareCode === 0) process.exit(0);
    process.exit(prepareCode || code || 1);
  });
});

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL("node_modules/playwright/cli.js", root)),
  "install", "chromium", ...process.argv.slice(2)
], {
  stdio: "inherit",
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: fileURLToPath(new URL("node_modules/.cache/playwright/", root)) }
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

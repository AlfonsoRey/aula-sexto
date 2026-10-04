import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(new URL("./node_modules/.cache/playwright/", import.meta.url));

export default defineConfig({
  testDir: "./browser-tests",
  fullyParallel: true,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:4173", browserName: "chromium" },
  webServer: {
    command: "node scripts/serve.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false
  }
});

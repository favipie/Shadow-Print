import { defineConfig } from "@playwright/test";
const url = process.env.SHADOWPRINT_PUBLIC_ORIGIN;
if (!url || !/^https:\/\/localhost:\d+$/.test(url))
  throw new Error("Use the isolated HTTPS rehearsal");
export default defineConfig({
  testDir: "./hosted-e2e",
  workers: 1,
  timeout: 90_000,
  globalTimeout: 180_000,
  use: {
    baseURL: url,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    ignoreHTTPSErrors: true,
    actionTimeout: 15_000,
  },
  reporter: "list",
});

import { defineConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
const database = process.env.SHADOWPRINT_TEST_DATABASE_URL;
const name =
  database?.match(
    /^mssql\+pyodbc:\/\/[^/?#]+\/(shadowprint_test_[0-9a-f]{32})(?:\?|$)/,
  )?.[1] ?? "";
if (
  !/^shadowprint_test_[0-9a-f]{32}$/.test(name) ||
  !fs.existsSync(path.resolve("backend/.test-output", name)) ||
  fs.readFileSync(path.resolve("backend/.test-output", name), "utf8") !== name
)
  throw new Error(
    "Run scripts/test-e2e.ps1; browser writes require an owned disposable SQL Server database.",
  );
const key = process.env.SHADOWPRINT_API_KEY;
if (!key || key.length < 32)
  throw new Error("Missing ephemeral test service key");
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  globalTimeout: 600_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    actionTimeout: 20_000,
    baseURL: "http://127.0.0.1:3002",
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `"${path.resolve(".venv/Scripts/python.exe")}" -m uvicorn main:app --host 127.0.0.1 --port 8001`,
      cwd: path.resolve("backend"),
      url: "http://127.0.0.1:8001/health/ready",
      timeout: 60_000,
      reuseExistingServer: false,
      env: { SHADOWPRINT_DATABASE_URL: database!, SHADOWPRINT_API_KEY: key },
    },
    {
      command:
        "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3002",
      url: "http://127.0.0.1:3002",
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        SHADOWPRINT_API_URL: "http://127.0.0.1:8001",
        SHADOWPRINT_API_KEY: key,
      },
    },
  ],
});

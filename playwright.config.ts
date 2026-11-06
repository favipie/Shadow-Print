import { defineConfig } from "@playwright/test";
import path from "node:path";
const database = process.env.SHADOWPRINT_TEST_DATABASE_URL;
if (
  !database ||
  !/^mssql\+pyodbc:\/\/[^?#]+\/[A-Za-z0-9_]+_test(?:\?|$)/.test(database)
)
  throw new Error(
    "Set SHADOWPRINT_TEST_DATABASE_URL to a disposable SQL Server *_test database",
  );
const key = "isolated-e2e-local-service-key-not-for-production";
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  use: {
    actionTimeout: 20_000,
    baseURL: "http://127.0.0.1:3002",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "uv run python -m uvicorn main:app --host 127.0.0.1 --port 8001",
      cwd: path.resolve("backend"),
      url: "http://127.0.0.1:8001/health/ready",
      timeout: 60_000,
      reuseExistingServer: false,
      env: { SHADOWPRINT_DATABASE_URL: database, SHADOWPRINT_API_KEY: key },
    },
    {
      command:
        "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3002",
      url: "http://127.0.0.1:3002",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        SHADOWPRINT_API_URL: "http://127.0.0.1:8001",
        SHADOWPRINT_API_KEY: key,
      },
    },
  ],
});

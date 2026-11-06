import { chromium } from "@playwright/test";
const base = process.env.SHADOWPRINT_SMOKE_WEB || "http://127.0.0.1:3000";
const api = process.env.SHADOWPRINT_SMOKE_API || "http://127.0.0.1:8000";
const health = await (await fetch(api + "/api/health")).json();
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  // This smoke check is read-only, including browser requests.
  await page.route("**/api/**", route =>
    route.request().method() === "GET" ? route.continue() : route.abort(),
  );
  const response = page.waitForResponse(api + "/api/workspace");
  await page.goto(base);
  const snapshot = await (await response).json();
  if (snapshot.settings.database !== health.database) throw new Error("Database mismatch");
  await page.getByRole("heading", { name: "See the pattern." }).waitFor();
  await page.goto(base + "/#settings");
  await page.getByText("AUTHORITATIVE SQL RULES · READ ONLY", { exact: true }).waitFor();
  console.log(JSON.stringify({ database: health.database, tables: health.tables, ...snapshot.dashboard }));
} finally {
  await browser.close();
}

import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

const api = "http://127.0.0.1:18000";
test.beforeEach(async ({ page, request }) => {
  const health = await request.get(api + "/api/health");
  expect(health.ok()).toBeTruthy();
  const db = (await health.json()).database;
  expect(db).toMatch(/^shadowprint_test_[0-9a-f]{32}$/);
  // Fail closed if the UI accidentally points at a different API/database.
  await page.route("**/api/**", (route) =>
    new URL(route.request().url()).origin === api
      ? route.continue()
      : route.abort(),
  );
  const response = page.waitForResponse(api + "/api/workspace");
  await page.goto("/");
  expect((await (await response).json()).settings.database).toBe(db);
  await expect(
    page.getByRole("heading", { name: "See the pattern." }),
  ).toBeVisible();
  await fs.mkdir("qa/phase45", { recursive: true });
});

test("complete investigation persists across reload and exports SQL report", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.screenshot({
    path: "qa/phase45/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Examine priority signal" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: /Threat monitor/i }).click();
  await page.getByLabel("Search comment or account").fill("C-352");
  await page.getByRole("link", { name: "C-352 · Inspect" }).click();
  await page.getByRole("link", { name: "Investigate account" }).click();
  await expect(page.getByText("50 / 100", { exact: true })).toBeVisible();
  await page.getByText("THREAT-01", { exact: true }).click();
  await expect(
    page
      .getByText(
        "[Fictional threat-language example; deliberately redacted in demo]",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open network" }).click();
  await expect(
    page.getByLabel("Account and device relationship graph"),
  ).toBeVisible();
  await page.getByLabel("Connection type").selectOption("Coordinated posting");
  await page.locator(".connection-row").first().click();
  await expect(
    page.getByRole("heading", { name: "Connection evidence" }),
  ).toBeVisible();
  await expect(
    page.locator(".network-detail").getByText("C-410", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "qa/phase45/network-desktop.png",
    fullPage: true,
  });

  await page.goto("/#threats?comment=C-352");
  await page.getByRole("link", { name: "Add to case", exact: true }).click();
  await page.getByRole("button", { name: "Create case with evidence" }).click();
  await page
    .getByLabel("Case title", { exact: true })
    .fill("Browser investigation");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Original SQL evidence reviewed end to end.");
  await page.getByRole("button", { name: "Save case", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/#cases\?case=SP-/);
  const caseId = new URLSearchParams(page.url().split("?")[1]).get("case")!;
  await page
    .getByLabel("New investigator note")
    .fill("Context checked; this is a synthetic supplied threat label.");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(
    page.getByText(
      "Context checked; this is a synthetic supplied threat label.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(
      "Context checked; this is a synthetic supplied threat label.",
      { exact: true },
    ),
  ).toBeVisible();

  await page.goto("/#threats?comment=C-352");
  await page
    .locator(".selected-comment")
    .getByRole("button", { name: "Mark reviewed C-352" })
    .click();
  await expect(
    page
      .locator(".selected-comment")
      .getByRole("button", { name: "Undo review C-352" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".selected-comment")
      .getByRole("button", { name: "Undo review C-352" }),
  ).toBeVisible();
  expect(
    (await (await request.get(api + "/api/comments/C-352")).json()).reviewed,
  ).toBe(true);

  await page.goto("/#reports?case=" + caseId);
  await expect(
    page.getByRole("heading", { name: "Browser investigation", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download report CSV" }).click();
  const exported = await download;
  const file = await exported.path();
  expect(await fs.readFile(file!, "utf8")).toContain("Context checked");
  expect(await fs.readFile(file!, "utf8")).toContain("C-352");
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Print report" }).click();
  const report = await popup;
  await report.waitForLoadState();
  await expect(
    report.getByRole("heading", { name: "Browser investigation" }),
  ).toBeVisible();
  await report.emulateMedia({ media: "print" });
  await report.screenshot({
    path: "qa/phase45/report-print.png",
    fullPage: true,
  });
  await report.pdf({
    path: "qa/phase45/investigation-report.pdf",
    format: "A4",
    printBackground: true,
  });
  await report.close();
  await page.screenshot({
    path: "qa/phase45/report-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect((await (await request.get(api + "/api/findings")).json()).length).toBe(
    11,
  );
});

test("mobile navigation, filters, pagination, empty results and settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "qa/phase45/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: /Threat monitor/i }).click();
  await expect(
    page.getByRole("heading", { name: "Comment review queue" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next comments" }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await page.getByLabel("Search comment or account").fill("no-such-comment");
  await expect(
    page.getByText("No matching records", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page
    .getByLabel("Category", { exact: true })
    .selectOption("Threat-related language");
  await expect(
    page.getByText("1 matching records", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "qa/phase45/threats-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/#coordination");
  await expect(
    page.getByRole("heading", { name: "Activity groups" }),
  ).toBeVisible();
  await page.getByLabel("Scenario type").selectOption("Benign control");
  await page.getByRole("button", { name: /Public library terminal/ }).click();
  await expect(page.getByText("NO MATCH", { exact: true })).toBeVisible();
  await page.goto("/#settings");
  await expect(
    page.getByText("AUTHORITATIVE SQL RULES · READ ONLY", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save thresholds" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "qa/phase45/settings-mobile.png",
    fullPage: true,
  });
});

test("connection failure is explicit and can be retried", async ({ page }) => {
  await page.route(api + "/api/workspace", (route) => route.abort());
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: "API unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "See the pattern." }),
  ).toHaveCount(0);
  await page.unroute(api + "/api/workspace");
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(
    page.getByRole("heading", { name: "See the pattern." }),
  ).toBeVisible();
});

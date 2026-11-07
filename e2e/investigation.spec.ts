import { test, expect } from "@playwright/test";
test.beforeEach(async ({ request }) => {
  const response = await request.get("/api/backend/settings");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).database_name).toMatch(
    /^shadowprint_test_[0-9a-f]{32}$/,
  );
});
test("SQL Server investigation persists across refresh and generates a complete report", async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const leaked: string[] = [];
  page.on("request", (r) => {
    if (r.headers().authorization || r.url().includes("8001"))
      leaked.push(r.url());
  });
  await page.goto("/");
  await expect(page.getByLabel("Overview metrics")).toContainText("28");
  await page.screenshot({
    path: testInfo.outputPath("overview.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Threat Monitor", exact: true }).click();
  await page.getByLabel("Search comment or account").fill("C-352");
  await page.getByRole("link", { name: "Open comment", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Original comment C-352" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Investigate account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "@null_signal" }),
  ).toBeVisible();
  await expect(page.getByText("50 / 100", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: /THREAT-01/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Inspect evidence E-C-352" })
    .first()
    .click();
  await expect(
    page.getByText("comments", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open network", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Accessible connection evidence" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inspect evidence E-L-1" }).click();
  await expect(page.getByText("login_events", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "A-001", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Devices & connected accounts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "@static_07", exact: true }).last(),
  ).toBeVisible();
  await page.goto("/#threats?comment=C-352");
  await page.getByRole("link", { name: "Add to case", exact: true }).click();
  await page.getByRole("button", { name: "Create case with evidence" }).click();
  const title = `Browser investigation ${Date.now()}`;
  await page.getByLabel("Case title", { exact: true }).fill(title);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Original evidence and contextual review, verified end to end.");
  await page.getByRole("button", { name: "Save case", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  const caseId = new URLSearchParams(page.url().split("?").pop()).get("case")!;
  await page
    .getByLabel("New investigator note")
    .fill("Browser persistence proof: reviewed original context.");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(
    page.getByText("Browser persistence proof: reviewed original context.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit case" }).click();
  await page
    .getByRole("combobox", { name: "Case status", exact: true })
    .selectOption("Under review");
  await page.getByRole("button", { name: "Save case", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByText(`${caseId} / Under review`, { exact: true }),
  ).toBeVisible();
  await page.goto("/#threats?comment=C-352");
  const previous = await request
    .get("/api/backend/comments/C-352")
    .then((r) => r.json());
  if (previous.reviewed)
    await page.getByRole("button", { name: "Undo review C-352" }).click();
  await page.getByRole("button", { name: "Mark reviewed C-352" }).click();
  await expect(
    page.getByRole("button", { name: "Undo review C-352" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Undo review C-352" }),
  ).toBeVisible();
  await page.goto(`/#cases?case=${caseId}`);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Browser persistence proof: reviewed original context.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open investigation report" }).click();
  await expect(
    page.getByRole("heading", { name: "Investigation report" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Prepare complete printable report" })
    .click();
  await expect(
    page.getByRole("button", { name: "Print / Save PDF" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export evidence CSV" }).click();
  expect((await download).suggestedFilename()).toBe(`${caseId}-evidence.csv`);
  await page.emulateMedia({ media: "print" });
  await expect(
    page
      .getByText("Browser persistence proof: reviewed original context.", {
        exact: true,
      })
      .last(),
  ).toBeVisible();
  await page.pdf({
    path: testInfo.outputPath("investigation.pdf"),
    format: "A4",
  });
  await page.emulateMedia({ media: "screen" });
  await expect(page.locator(".main-shell")).toHaveCSS("margin-left", "238px");
  await page.screenshot({
    path: testInfo.outputPath("report.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
  expect(leaked).toEqual([]);
  expect(
    (
      await request
        .get(`/api/backend/cases/${caseId}/notes`)
        .then((r) => r.json())
    ).items.some((n: { body: string }) => n.body.includes("persistence proof")),
  ).toBeTruthy();
});
test("pagination, coordination, settings, mobile navigation and API errors", async ({
  page,
  request,
}, testInfo) => {
  await page.goto("/#threats");
  await expect(page.getByLabel("comments pagination")).toContainText("of 28");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("comments pagination")).toContainText(
    "21\u201328",
  );
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Spam");
  await expect(page.getByLabel("comments pagination")).toContainText("of 14");
  await page
    .getByRole("link", { name: "Coordination Analysis", exact: true })
    .click();
  await page.getByRole("button", { name: /C-410/ }).click();
  await expect(page.getByText("C-412", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByText("Microsoft SQL Server", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Audit history" }),
  ).toBeVisible();
  expect(
    (
      await request.post("/api/backend/cases", {
        headers: { origin: "https://evil.example" },
        data: { title: "Must reject" },
      })
    ).status(),
  ).toBe(403);
  await page.route("**/api/backend/overview*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Test backend unavailable" }),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("alert").filter({ hasText: "Test backend unavailable" }),
  ).toContainText("Test backend unavailable");
  await page.unroute("**/api/backend/overview*");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByLabel("Overview metrics")).toContainText("28");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Account Investigator", exact: true })
    .click();
  await page.getByLabel("Search account or ID").fill("library_one");
  await page.getByRole("link", { name: /@library_one/ }).click();
  await expect(page.getByText("0 / 100", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("mobile-account.png"),
    fullPage: true,
    animations: "disabled",
  });
});

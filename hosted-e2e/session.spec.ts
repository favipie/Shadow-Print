import { test, expect } from "@playwright/test";

test("invited investigator signs in over HTTPS, persists a case in both SQL modes, and signs out", async ({
  page,
  request,
}) => {
  const base = process.env.SHADOWPRINT_PUBLIC_ORIGIN!;
  const unauthorized = await request.get("/api/backend/cases");
  expect(unauthorized.status()).toBe(401);
  // Both page modes and the fixture interface require a session in hosted mode.
  for (const path of ["/", "/?mode=workspace", "/?mode=demo"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Investigator sign-in" }),
    ).toBeVisible();
  }
  const browserRequests: string[] = [];
  page.on("request", (r) => {
    if (
      r.headers().authorization ||
      r.headers()["x-shadowprint-session"] ||
      r.url().startsWith(process.env.SHADOWPRINT_API_URL!)
    )
      browserRequests.push(new URL(r.url()).pathname);
  });
  await page.getByLabel("Username").fill("analyst");
  await page.getByLabel("Password").fill(process.env.REHEARSAL_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel("Overview metrics")).toContainText("28");
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "__Host-shadowprint",
  );
  expect(cookie?.secure).toBe(true);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  const client = page.context().request;
  expect((await client.get("/api/backend/settings")).status()).toBe(200);
  const db = (await (await client.get("/api/backend/settings")).json())
    .database_name;
  expect(db).toMatch(/^shadowprint_test_[0-9a-f]{32}$/);
  expect(
    (
      await client.post("/api/backend/cases", {
        headers: { origin: "https://untrusted.example" },
        data: { title: "Rejected" },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/#threats?comment=C-352");
  await expect(
    page.getByRole("heading", { name: "Original comment C-352" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Investigate account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "@null_signal" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open network", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Accessible connection evidence" }),
  ).toBeVisible();
  await page.goto("/#coordination");
  await page.getByRole("button", { name: /C-410/ }).click();
  await expect(page.getByText("C-412", { exact: true })).toBeVisible();
  const saved = await client.post("/api/backend/cases", {
    headers: { origin: base },
    data: { title: "Hosted HTTPS rehearsal", evidence_ids: ["E-C-352"] },
  });
  expect(saved.status()).toBe(201);
  const id = (await saved.json()).id;
  await page.goto("/#cases?case=" + id);
  await expect(
    page.getByRole("heading", { name: "Hosted HTTPS rehearsal", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hosted HTTPS rehearsal", exact: true }),
  ).toBeVisible();
  await page.goto("/?mode=workspace#reports?case=" + id);
  await expect(
    page.getByRole("heading", { name: "Hosted HTTPS rehearsal", exact: true }),
  ).toBeVisible();
  const report = await client.get(
    "/api/backend/legacy/api/reports/" + id + "?format=csv",
  );
  expect(await report.text()).toContain("C-352");
  await page.route("**/api/backend/overview*", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Rehearsal outage" }),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("alert").filter({ hasText: "Rehearsal outage" }),
  ).toBeVisible();
  await page.unroute("**/api/backend/overview*");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByLabel("Overview metrics")).toContainText("28");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Audit history" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Investigator sign-in" }),
  ).toBeVisible();
  expect((await client.get("/api/backend/accounts")).status()).toBe(401);
  expect(browserRequests).toEqual([]);
});

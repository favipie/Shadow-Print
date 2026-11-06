import "./dom-setup.mjs";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SqlProvider, useLive } from "../src/components/data-provider";
import { useDemo } from "../src/components/demo-provider";
import type { WorkspaceData } from "../src/lib/api";

const originalFetch = globalThis.fetch;
const dataset: WorkspaceData = {
  profiles: [],
  comments: [],
  devices: [],
  logins: [],
  connections: [],
  clusters: [],
  findings: [],
  events: [],
  activity: [],
  accounts: [],
  state: {
    version: 2,
    reviewed: [],
    cases: [],
    audit: [],
    thresholds: {
      repetition: 5,
      windowMinutes: 30,
      coordinationAccounts: 3,
      coordinationSeconds: 90,
    },
  },
  settings: {
    database: "test",
    rules: [],
    provenance: [],
    thresholdsEditable: false,
    limitation: "Synthetic test data",
  },
  dashboard: {
    accounts: 0,
    comments: 0,
    annotatedComments: 0,
    detectedComments: 0,
    findings: 0,
    openCases: 0,
    riskBreakdown: {},
    periodEnd: "2026-11-05",
  },
};
function Probe() {
  const { state } = useDemo();
  const live = useLive()!;
  return (
    <>
      <p>
        SQL state:{" "}
        {state.reviewed.includes("C-352") ? "reviewed" : "unreviewed"}
      </p>
      <button
        disabled={live.busy}
        onClick={() => void live.review("C-352", true).catch(() => {})}
      >
        Persist review
      </button>
    </>
  );
}
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  localStorage.clear();
});

test("SQL provider shows explicit failure, no fixture fallback, and retries", async () => {
  let fail = true;
  globalThis.fetch = async () => {
    if (fail) throw new Error("offline");
    return Response.json(dataset);
  };
  render(
    <SqlProvider>
      <Probe />
    </SqlProvider>,
  );
  await screen.findByRole("alert");
  assert.equal(screen.queryByText("SQL state: unreviewed"), null);
  fail = false;
  await userEvent.click(
    screen.getByRole("button", { name: "Retry connection" }),
  );
  await screen.findByText("SQL state: unreviewed");
  assert.equal(localStorage.length, 0);
});

test("review confirms server persistence through refresh without browser storage", async () => {
  let stored = false;
  const calls: string[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    if (options?.method === "POST") {
      assert.equal(
        (options.headers as Record<string, string>)["X-Shadowprint-Client"],
        "local-workspace",
      );
      assert.equal(JSON.parse(options.body as string).reviewed, true);
      stored = true;
      return Response.json({ reviewed: true });
    }
    return Response.json({
      ...dataset,
      state: { ...dataset.state, reviewed: stored ? ["C-352"] : [] },
    });
  };
  render(
    <SqlProvider>
      <Probe />
    </SqlProvider>,
  );
  await screen.findByText("SQL state: unreviewed");
  await userEvent.click(screen.getByRole("button", { name: "Persist review" }));
  await screen.findByText("SQL state: reviewed");
  assert.ok(calls.some((url) => url.endsWith("/api/comments/C-352/review")));
  assert.equal(localStorage.length, 0);
});

test("failed review does not optimistically change saved state", async () => {
  globalThis.fetch = async (_, options) =>
    options?.method === "POST"
      ? Response.json({ detail: "Database operation failed." }, { status: 503 })
      : Response.json(dataset);
  render(
    <SqlProvider>
      <Probe />
    </SqlProvider>,
  );
  await screen.findByText("SQL state: unreviewed");
  await userEvent.click(screen.getByRole("button", { name: "Persist review" }));
  await waitFor(() =>
    assert.match(
      screen.getByRole("alert").textContent ?? "",
      /Database operation failed/,
    ),
  );
  assert.ok(screen.getByText("SQL state: unreviewed"));
});

import "./dom-setup.mjs";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoProvider } from "../src/components/demo-provider";
import Threats from "../src/components/screens/threats";
import Accounts from "../src/components/screens/accounts";
import Cases from "../src/components/screens/cases";
import Settings from "../src/components/screens/settings";
import Reports from "../src/components/screens/reports";
import Coordination from "../src/components/screens/coordination";
import { EvidenceDialog } from "../src/components/evidence-dialog";
import { downloads } from "./dom-setup.mjs";
const renderDemo = (ui: React.ReactNode) =>
  render(<DemoProvider>{ui}</DemoProvider>);
afterEach(() => {
  cleanup();
  localStorage.clear();
  downloads.length = 0;
});
test("comment search, category filter, review toggle and CSV export execute", async () => {
  const user = userEvent.setup();
  renderDemo(<Threats params={new URLSearchParams()} />);
  await user.type(screen.getByLabelText("Search comment or account"), "C-352");
  assert.equal(screen.getAllByRole("row").length, 2);
  await user.click(screen.getByRole("button", { name: "Mark reviewed C-352" }));
  assert.ok(screen.getByRole("button", { name: "Undo review C-352" }));
  await user.selectOptions(screen.getByLabelText("Review state"), "Unreviewed");
  assert.ok(screen.getByText("No matching records"));
  await user.click(screen.getByRole("button", { name: "Reset filters" }));
  await user.selectOptions(screen.getByLabelText("Category"), "Spam");
  assert.equal(screen.getAllByRole("row").length, 15);
  await user.click(screen.getByRole("button", { name: "Export filtered CSV" }));
  assert.equal(downloads.length, 1);
  const content = await downloads[0].text();
  assert.ok(content.includes("C-370"));
  assert.ok(!content.includes("C-352"));
});
test("comment carries stable account/network/case links", () => {
  renderDemo(<Threats params={new URLSearchParams("comment=C-352")} />);
  assert.equal(
    screen
      .getByRole("link", { name: "Investigate account" })
      .getAttribute("href"),
    "#accounts?account=A-003",
  );
  assert.equal(
    screen.getByRole("link", { name: "View network" }).getAttribute("href"),
    "#network?account=A-003",
  );
  assert.equal(
    screen.getByRole("link", { name: "Add to case" }).getAttribute("href"),
    "#cases?comment=C-352",
  );
});
test("analysis runs and returns evidence; unknown account renders empty state", async () => {
  const user = userEvent.setup();
  const view = renderDemo(
    <Accounts params={new URLSearchParams("account=A-004")} />,
  );
  await user.click(screen.getByRole("button", { name: "Run demo analysis" }));
  assert.ok(screen.getByText("25 / 100"));
  assert.ok(screen.getByText("REP-01"));
  view.unmount();
  renderDemo(<Accounts params={new URLSearchParams("account=missing")} />);
  assert.ok(screen.getByText("Account not found"));
});
test("case creation, decision validation, note saving and persistence work", async () => {
  const user = userEvent.setup();
  renderDemo(<Cases params={new URLSearchParams("comment=C-352")} />);
  await user.click(
    screen.getByRole("button", { name: "Create case with evidence" }),
  );
  await user.type(screen.getByLabelText("Case title"), "QA case");
  await user.type(screen.getByLabelText("Description"), "Review demo context.");
  await user.selectOptions(screen.getByLabelText("Case status"), "Closed");
  await user.click(screen.getByRole("button", { name: "Save case" }));
  assert.ok(screen.getByRole("alert").textContent?.includes("decision"));
  await user.type(
    screen.getByLabelText("Decision / resolution"),
    "No moderation action.",
  );
  await user.click(screen.getByRole("button", { name: "Save case" }));
  await waitFor(() => assert.equal(screen.queryByRole("dialog"), null));
  const saved = JSON.parse(localStorage.getItem("shadowprint.demo.v2")!);
  assert.equal(saved.cases[0].title, "QA case");
  assert.deepEqual(saved.cases[0].commentIds, ["C-352"]);
  assert.equal(saved.cases[0].status, "Closed");
  await user.type(
    screen.getByLabelText("New investigator note"),
    "Reviewed the original context.",
  );
  await user.click(screen.getByRole("button", { name: "Add note" }));
  assert.ok(screen.getByText("Reviewed the original context."));
});
test("settings persist threshold changes and coordination reflects those thresholds", async () => {
  const user = userEvent.setup();
  const view = renderDemo(<Settings />);
  const field = screen.getByLabelText("Coordination window (seconds) (10–600)");
  await user.clear(field);
  await user.type(field, "60");
  await user.click(screen.getByRole("button", { name: "Save thresholds" }));
  assert.equal(
    JSON.parse(localStorage.getItem("shadowprint.demo.v2")!).thresholds
      .coordinationSeconds,
    60,
  );
  view.unmount();
  renderDemo(<Coordination />);
  await waitFor(() => assert.ok(screen.getByText("NO MATCH")));
});
test("reports include evidence and download current case CSV", async () => {
  const user = userEvent.setup();
  renderDemo(<Reports params={new URLSearchParams("case=SP-0100")} />);
  assert.ok(screen.getByText("Echo chamber"));
  assert.ok(screen.getByText("C-410"));
  await user.click(screen.getByRole("button", { name: "Download report CSV" }));
  assert.ok((await downloads[0].text()).includes("SP-0100"));
  assert.ok((await downloads[0].text()).includes("Limitations"));
});
test("evidence dialog opens with accessible name and closes via action", async () => {
  const user = userEvent.setup();
  let closed = false;
  render(
    <EvidenceDialog
      detail={{
        title: "Evidence record",
        subtitle: "Synthetic",
        records: ["C-410 original record"],
      }}
      onClose={() => {
        closed = true;
      }}
    />,
  );
  assert.ok(screen.getByRole("dialog", { name: "Evidence record" }));
  await user.click(screen.getByRole("button", { name: "Close evidence" }));
  assert.ok(closed);
});

test("account directory accepts case-insensitive account IDs", async () => {
  const user = userEvent.setup();
  renderDemo(<Accounts params={new URLSearchParams()} />);
  await user.type(screen.getByLabelText("Search account or ID"), "a-004");
  assert.ok(screen.getByText("1 of 9 accounts"));
  assert.ok(screen.getByRole("link", { name: /RE\s*@relay_fox\s*A-004/ }));
});

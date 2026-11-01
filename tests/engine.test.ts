import test from "node:test";
import assert from "node:assert/strict";
import {
  comments,
  profiles,
  devices,
  connections,
  logins,
  defaultThresholds,
  initialCases,
} from "../src/lib/investigation-data";
import {
  analyzeAccount,
  coordinationEvidence,
  csvText,
  initialState,
  parseSavedState,
  caseValidation,
} from "../src/lib/demo-engine";
import { activity, events } from "../src/lib/mock-data";
test("all comment, case, login and graph references resolve", () => {
  const accountIds = new Set(profiles.map((p) => p.id));
  const commentIds = new Set(comments.map((c) => c.id));
  const nodeIds = new Set([...accountIds, ...devices.map((d) => d.id)]);
  assert.equal(commentIds.size, comments.length);
  for (const c of comments) {
    assert.ok(accountIds.has(c.accountId));
    assert.ok(accountIds.has(c.targetId));
    assert.ok(Number.isFinite(Date.parse(c.at)));
  }
  for (const c of initialCases) {
    assert.ok(c.accountIds.every((id) => accountIds.has(id)));
    assert.ok(c.commentIds.every((id) => commentIds.has(id)));
  }
  for (const e of connections) {
    assert.ok(nodeIds.has(e.source) && nodeIds.has(e.target));
    assert.ok(
      e.evidence.every(
        (id) => commentIds.has(id) || logins.some((l) => l.id === id),
      ),
    );
  }
});
test("dashboard totals reconcile to original records, not invented volumes", () => {
  assert.equal(
    activity.reduce((n, a) => n + a.analyzed, 0),
    comments.length,
  );
  assert.equal(
    activity.reduce((n, a) => n + a.flagged, 0),
    comments.filter((c) => c.category !== "Unflagged").length,
  );
  assert.equal(
    new Set(comments.flatMap((c) => (c.eventId ? [c.eventId] : []))).size,
    events.length,
  );
});
test("duplicate scenario triggers with exact evidence and respects threshold changes", () => {
  const found = analyzeAccount("A-004", defaultThresholds).find(
    (f) => f.rule === "REP-01",
  );
  assert.equal(found?.commentIds.length, 8);
  assert.ok(
    !analyzeAccount("A-004", { ...defaultThresholds, repetition: 9 }).some(
      (f) => f.rule === "REP-01",
    ),
  );
});
test("coordination evaluates same text, target, accounts and precise time window", () => {
  assert.deepEqual(
    coordinationEvidence(defaultThresholds).map((c) => c.id),
    ["C-410", "C-411", "C-412"],
  );
  assert.equal(
    coordinationEvidence({ ...defaultThresholds, coordinationSeconds: 60 })
      .length,
    0,
  );
  assert.equal(
    coordinationEvidence({ ...defaultThresholds, coordinationAccounts: 4 })
      .length,
    0,
  );
});
test("shared library devices do not contribute a risk signal", () => {
  assert.deepEqual(analyzeAccount("A-007", defaultThresholds), []);
  assert.deepEqual(analyzeAccount("A-008", defaultThresholds), []);
});
test("state schema rejects corrupt, unknown and dangling saved records", () => {
  const original = initialState();
  assert.deepEqual(parseSavedState(JSON.stringify(original)), original);
  assert.throws(() => parseSavedState("{bad"));
  assert.throws(() =>
    parseSavedState(JSON.stringify({ ...original, version: 1 })),
  );
  const bad = structuredClone(original);
  bad.cases[0].commentIds = ["C-MISSING"];
  assert.throws(() => parseSavedState(JSON.stringify(bad)));
});
test("case closure requires a decision and meaningful associations", () => {
  const c = initialCases[0];
  assert.match(caseValidation({ ...c, status: "Closed" }), /decision/);
  assert.equal(
    caseValidation({
      ...c,
      status: "Closed",
      decision: "Reviewed context; no action.",
    }),
    "",
  );
  assert.match(
    caseValidation({ ...c, accountIds: [], commentIds: [] }),
    /Associate/,
  );
});
test("CSV quotes multiline content and neutralizes spreadsheet formulas", () => {
  const csv = csvText([
    ["Title", "Notes"],
    ["=1+2", 'a,"quoted"\nline'],
    ["@handle", "safe"],
  ]);
  assert.ok(csv.includes('"\'=1+2"'));
  assert.ok(csv.includes('"a,""quoted""\nline"'));
  assert.ok(csv.includes('"\'@handle"'));
});

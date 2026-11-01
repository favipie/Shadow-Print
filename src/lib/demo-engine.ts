import {
  comments,
  profiles,
  initialCases,
  defaultThresholds,
  statuses,
  type CaseRecord,
  type Thresholds,
} from "./investigation-data";
export type Finding = {
  rule: string;
  reason: string;
  weight: number;
  commentIds: string[];
};
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export function analyzeAccount(accountId: string, t: Thresholds): Finding[] {
  const own = comments.filter((c) => c.accountId === accountId);
  const findings: Finding[] = [];
  let repeated: string[] = [];
  for (const start of own) {
    const ids = own
      .filter(
        (c) =>
          normalize(c.text) === normalize(start.text) &&
          Date.parse(c.at) >= Date.parse(start.at) &&
          Date.parse(c.at) - Date.parse(start.at) <= t.windowMinutes * 60000,
      )
      .map((c) => c.id);
    if (ids.length > repeated.length) repeated = ids;
  }
  if (repeated.length >= t.repetition)
    findings.push({
      rule: "REP-01",
      reason: `${repeated.length} identical normalized comments in ${t.windowMinutes} minutes. Repeated reminders can be benign.`,
      weight: 25,
      commentIds: repeated,
    });
  const threats = own.filter((c) => c.category === "Threat-related language");
  if (threats.length)
    findings.push({
      rule: "LABEL-01",
      reason: "Authored threat-related label; no NLP detector was run.",
      weight: 25,
      commentIds: threats.map((c) => c.id),
    });
  const targeted = own.filter((c) => c.category === "Repeated harassment");
  if (targeted.length >= 3)
    findings.push({
      rule: "TARGET-01",
      reason:
        "At least three authored harassment labels directed to the same target.",
      weight: 20,
      commentIds: targeted.map((c) => c.id),
    });
  const coordinated = coordinationEvidence(t);
  if (coordinated.some((c) => c.accountId === accountId))
    findings.push({
      rule: "COORD-01",
      reason: `${new Set(coordinated.map((c) => c.accountId)).size} accounts, identical text, same target within ${t.coordinationSeconds} seconds.`,
      weight: 30,
      commentIds: coordinated.map((c) => c.id),
    });
  return findings;
}
export function coordinationEvidence(t: Thresholds) {
  for (const start of comments) {
    const group = comments.filter(
      (c) =>
        c.targetId === start.targetId &&
        normalize(c.text) === normalize(start.text) &&
        Date.parse(c.at) >= Date.parse(start.at) &&
        Date.parse(c.at) - Date.parse(start.at) <= t.coordinationSeconds * 1000,
    );
    if (new Set(group.map((c) => c.accountId)).size >= t.coordinationAccounts)
      return group;
  }
  return [];
}
export const scorePriority = (score: number) =>
  score >= 45 ? "High" : score >= 20 ? "Medium" : "Low";
export function csvText(rows: string[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map(
            (value) =>
              '"' +
              (/^[\s]*[=+\-@]/.test(value) ? "'" : "") +
              value.replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}
export function download(
  name: string,
  content: string,
  type = "text/csv;charset=utf-8;",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function route(section: string, key?: string, id?: string) {
  return (
    "#" + section + (key && id ? "?" + key + "=" + encodeURIComponent(id) : "")
  );
}
export type Audit = { id: string; at: string; action: string };
export type DemoState = {
  version: 2;
  cases: CaseRecord[];
  reviewed: string[];
  thresholds: Thresholds;
  audit: Audit[];
};
export const initialState = (): DemoState => ({
  version: 2,
  cases: structuredClone(initialCases),
  reviewed: [],
  thresholds: { ...defaultThresholds },
  audit: [],
});
export function validThresholds(t: Thresholds) {
  return (
    Number.isInteger(t.repetition) &&
    t.repetition >= 2 &&
    t.repetition <= 20 &&
    Number.isInteger(t.windowMinutes) &&
    t.windowMinutes >= 1 &&
    t.windowMinutes <= 120 &&
    Number.isInteger(t.coordinationAccounts) &&
    t.coordinationAccounts >= 2 &&
    t.coordinationAccounts <= 9 &&
    Number.isInteger(t.coordinationSeconds) &&
    t.coordinationSeconds >= 10 &&
    t.coordinationSeconds <= 600
  );
}
export function parseSavedState(raw: string): DemoState {
  const s = JSON.parse(raw) as DemoState;
  if (
    s.version !== 2 ||
    !Array.isArray(s.cases) ||
    !Array.isArray(s.reviewed) ||
    !Array.isArray(s.audit) ||
    !s.thresholds ||
    !validThresholds(s.thresholds)
  )
    throw Error("Unsupported saved state");
  const ids = new Set<string>();
  for (const c of s.cases) {
    if (
      !c ||
      typeof c.id !== "string" ||
      ids.has(c.id) ||
      typeof c.title !== "string" ||
      !c.title.trim() ||
      typeof c.description !== "string" ||
      typeof c.decision !== "string" ||
      !statuses.includes(c.status) ||
      !Number.isFinite(Date.parse(c.updatedAt)) ||
      !Array.isArray(c.accountIds) ||
      !c.accountIds.every((id) => profiles.some((p) => p.id === id)) ||
      !Array.isArray(c.commentIds) ||
      !c.commentIds.every((id) => comments.some((p) => p.id === id)) ||
      !Array.isArray(c.notes) ||
      !c.notes.every(
        (n) => typeof n.text === "string" && Number.isFinite(Date.parse(n.at)),
      )
    )
      throw Error("Invalid saved case");
    ids.add(c.id);
  }
  if (
    !s.reviewed.every(
      (id) =>
        typeof id === "string" &&
        (comments.some((c) => c.id === id) || /^EV-104[3-8]$/.test(id)),
    ) ||
    !s.audit.every(
      (a) =>
        typeof a.id === "string" &&
        typeof a.action === "string" &&
        Number.isFinite(Date.parse(a.at)),
    )
  )
    throw Error("Invalid review history");
  return s;
}
export function caseValidation(
  c: Pick<
    CaseRecord,
    | "title"
    | "description"
    | "status"
    | "decision"
    | "accountIds"
    | "commentIds"
  >,
) {
  if (!c.title.trim() || c.title.trim().length > 100)
    return "Enter a case title (1–100 characters).";
  if (!c.description.trim() || c.description.length > 1500)
    return "Enter a description (1–1500 characters).";
  if (["Resolved", "Closed"].includes(c.status) && !c.decision.trim())
    return "Record a decision before resolving or closing the case.";
  if (c.decision.length > 1500)
    return "Decision must be at most 1500 characters.";
  if (!c.accountIds.length && !c.commentIds.length)
    return "Associate at least one account or comment.";
  return "";
}

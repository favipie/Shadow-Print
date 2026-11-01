import { comments } from "./investigation-data";
export type FlagEvent = {
  id: string;
  account: string;
  initials: string;
  category: string;
  reason: string;
  priority: "High" | "Medium" | "Low";
  time: string;
  day: number;
  evidence: string[];
};
export const events: FlagEvent[] = [
  {
    id: "EV-1048",
    account: "echo_vector",
    initials: "EV",
    category: "Coordinated targeting",
    reason: "3 accounts · same target · 90-second window",
    priority: "High",
    time: "18 Oct, 14:32",
    day: 18,
    evidence: [
      "C-410: @echo_vector → fictional target U-021 at 14:31:05",
      "C-411: @static_07 → fictional target U-021 at 14:31:41",
      "C-412: @null_signal → fictional target U-021 at 14:32:12",
      "Rule COORD-01: three distinct accounts in 90 seconds. A review signal, not proof of shared identity.",
    ],
  },
  {
    id: "EV-1047",
    account: "static_07",
    initials: "S7",
    category: "Repeated harassment",
    reason: "6 labeled comments directed at one account",
    priority: "High",
    time: "18 Oct, 13:18",
    day: 18,
    evidence: [
      "C-390–395: six synthetic labeled comments targeting U-021 over 24 hours.",
      "Labels were authored for this demo; no NLP classifier has run.",
    ],
  },
  {
    id: "EV-1046",
    account: "relay_fox",
    initials: "RF",
    category: "Spam",
    reason: "Identical normalized text posted 8 times",
    priority: "Medium",
    time: "17 Oct, 11:46",
    day: 17,
    evidence: [
      "C-370–377: “Visit our demo promotion page” repeated eight times in 12 minutes.",
      "Rule REP-01: at least five identical normalized comments within 30 minutes.",
    ],
  },
  {
    id: "EV-1045",
    account: "null_signal",
    initials: "NS",
    category: "Threat-related language",
    reason: "Synthetic threat label · awaiting context review",
    priority: "High",
    time: "16 Oct, 10:09",
    day: 16,
    evidence: [
      "C-352: synthetic threat-language label supplied by the fixture author.",
      "Context and human review are required; this is not a validated threat prediction.",
    ],
  },
  {
    id: "EV-1044",
    account: "paper_crane",
    initials: "PC",
    category: "Toxic or insulting content",
    reason: "One supplied label · context required",
    priority: "Low",
    time: "13 Oct, 09:42",
    day: 13,
    evidence: [
      "C-321: synthetic insulting-content label supplied by the fixture author.",
      "Single indicators do not establish harmful intent.",
    ],
  },
  {
    id: "EV-1043",
    account: "quiet_orbit",
    initials: "QO",
    category: "Spam",
    reason: "Repeated comment pattern in a demo thread",
    priority: "Medium",
    time: "08 Oct, 16:04",
    day: 8,
    evidence: [
      "C-290–295: six duplicate comments in a simulated thread.",
      "Repetition can have benign explanations. Review before action.",
    ],
  },
];
export const activity = Array.from({ length: 14 }, (_, i) => {
  const day = i + 5;
  const rows = comments.filter((c) => Number(c.at.slice(8, 10)) === day);
  return {
    day,
    label: "Oct " + day,
    analyzed: rows.length,
    flagged: rows.filter((c) => c.category !== "Unflagged").length,
  };
});
export const cases = [
  {
    id: "SP-0100",
    title: "Echo chamber",
    detail: "Coordinated activity around U-021",
    status: "Under review",
    accounts: 3,
    priority: "High",
  },
  {
    id: "SP-0099",
    title: "Repeated outreach",
    detail: "Duplicate comments across demo threads",
    status: "Needs more evidence",
    accounts: 2,
    priority: "Medium",
  },
  {
    id: "SP-0098",
    title: "Shared access",
    detail: "Benign shared-device control scenario",
    status: "Open",
    accounts: 2,
    priority: "Low",
  },
];
export const accounts = [
  { name: "echo_vector", initials: "EV", signals: 1, priority: "High" },
  { name: "static_07", initials: "S7", signals: 2, priority: "High" },
  { name: "relay_fox", initials: "RF", signals: 1, priority: "Medium" },
];
export const sections = [
  {
    slug: "overview",
    name: "Overview",
    description: "Your investigation workspace at a glance.",
  },
  {
    slug: "accounts",
    name: "Account investigator",
    description:
      "Search fictional accounts and examine evidence-backed activity.",
  },
  {
    slug: "network",
    name: "Network explorer",
    description: "Explore account and pseudonymous device connections.",
  },
  {
    slug: "threats",
    name: "Threat monitor",
    description: "Review labeled comments and their flagging reasons.",
  },
  {
    slug: "coordination",
    name: "Coordination analysis",
    description: "Investigate temporal patterns and shared targets.",
  },
  {
    slug: "cases",
    name: "Case management",
    description: "Organize evidence, investigator notes, and decisions.",
  },
  {
    slug: "reports",
    name: "Reports",
    description: "Create case summaries and evidence exports.",
  },
  {
    slug: "settings",
    name: "Settings & data",
    description: "Inspect dataset provenance, thresholds, and configuration.",
  },
];

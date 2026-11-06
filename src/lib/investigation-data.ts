export const profiles = [
  {
    id: "A-001",
    handle: "echo_vector",
    created: "2026-08-01",
    bio: "Fictional campaign account",
    devices: ["D-001"],
  },
  {
    id: "A-002",
    handle: "static_07",
    created: "2026-08-04",
    bio: "Fictional repeated-targeting scenario",
    devices: ["D-001"],
  },
  {
    id: "A-003",
    handle: "null_signal",
    created: "2026-08-05",
    bio: "Fictional supplied-label scenario",
    devices: ["D-002"],
  },
  {
    id: "A-004",
    handle: "relay_fox",
    created: "2026-07-10",
    bio: "Fictional repeated promotion scenario",
    devices: ["D-003"],
  },
  {
    id: "A-005",
    handle: "paper_crane",
    created: "2026-05-12",
    bio: "Fictional context-review example",
    devices: ["D-004"],
  },
  {
    id: "A-006",
    handle: "quiet_orbit",
    created: "2026-04-11",
    bio: "Fictional repetition example",
    devices: ["D-005"],
  },
  {
    id: "A-007",
    handle: "library_one",
    created: "2026-02-01",
    bio: "Benign shared-library device control",
    devices: ["D-006"],
  },
  {
    id: "A-008",
    handle: "library_two",
    created: "2026-03-03",
    bio: "Benign shared-library device control",
    devices: ["D-006"],
  },
  {
    id: "U-021",
    handle: "river_note",
    created: "2026-01-01",
    bio: "Fictional target account; not a suspect",
    devices: [],
  },
];
export type CommentRecord = {
  id: string;
  accountId: string;
  targetId: string;
  text: string;
  at: string;
  category: string;
  source: "Authored label" | "Rule example" | "Unlabeled" | "Public dataset" | "Human review";
  eventId?: string | null;
};
export const comments: CommentRecord[] = [
  ...["A-001", "A-002", "A-003"].map((accountId, i) => ({
    id: `C-${410 + i}`,
    accountId,
    targetId: "U-021",
    text: "Everyone, repeat this reply on the same thread.",
    at: `2026-10-18T14:${i === 2 ? "32" : "31"}:${["05", "41", "12"][i]}Z`,
    category: "Coordinated targeting",
    source: "Rule example" as const,
    eventId: "EV-1048",
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `C-${390 + i}`,
    accountId: "A-002",
    targetId: "U-021",
    text: `Mock hostile reply ${i + 1}: stop posting here.`,
    at: `2026-10-18T${String(8 + i).padStart(2, "0")}:18:00Z`,
    category: "Repeated harassment",
    source: "Authored label" as const,
    eventId: "EV-1047",
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `C-${370 + i}`,
    accountId: "A-004",
    targetId: "U-021",
    text: "Visit our demo promotion page",
    at: new Date(Date.UTC(2026, 9, 17, 11, 34 + i * 1.5)).toISOString(),
    category: "Spam",
    source: "Rule example" as const,
    eventId: "EV-1046",
  })),
  {
    id: "C-352",
    accountId: "A-003",
    targetId: "U-021",
    text: "[Fictional threat-language example; deliberately redacted in demo]",
    at: "2026-10-16T10:09:00Z",
    category: "Threat-related language",
    source: "Authored label",
    eventId: "EV-1045",
  },
  {
    id: "C-321",
    accountId: "A-005",
    targetId: "U-021",
    text: "That is a ridiculous opinion.",
    at: "2026-10-13T09:42:00Z",
    category: "Toxic or insulting content",
    source: "Authored label",
    eventId: "EV-1044",
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `C-${290 + i}`,
    accountId: "A-006",
    targetId: "U-021",
    text: "Reminder: demo meeting starts soon.",
    at: `2026-10-08T16:0${i}:00Z`,
    category: "Spam",
    source: "Rule example" as const,
    eventId: "EV-1043",
  })),
  {
    id: "C-501",
    accountId: "A-007",
    targetId: "U-021",
    text: "The library closes at six today.",
    at: "2026-10-17T09:00:00Z",
    category: "Unflagged",
    source: "Unlabeled",
  },
  {
    id: "C-502",
    accountId: "A-008",
    targetId: "A-007",
    text: "Thanks for the opening-hours update.",
    at: "2026-10-18T11:00:00Z",
    category: "Unflagged",
    source: "Unlabeled",
  },
  {
    id: "C-503",
    accountId: "U-021",
    targetId: "A-005",
    text: "I disagree, but appreciate the feedback.",
    at: "2026-10-13T10:00:00Z",
    category: "Unflagged",
    source: "Unlabeled",
  },
];
export const devices = [
  {
    id: "D-001",
    name: "Shared browser profile",
    context: "Simulated association; does not prove identity.",
  },
  {
    id: "D-002",
    name: "Demo mobile",
    context: "Pseudonymous fictional device.",
  },
  {
    id: "D-003",
    name: "Demo desktop",
    context: "Pseudonymous fictional device.",
  },
  {
    id: "D-004",
    name: "Demo tablet",
    context: "Pseudonymous fictional device.",
  },
  {
    id: "D-005",
    name: "Demo laptop",
    context: "Pseudonymous fictional device.",
  },
  {
    id: "D-006",
    name: "Public library terminal",
    context: "Known benign shared-device control. No behavioral flag.",
  },
];
export const logins = profiles.flatMap((p, i) =>
  p.devices.map((deviceId) => ({
    id: `L-${i + 1}`,
    accountId: p.id,
    deviceId,
    at: `2026-10-18T${String(7 + i).padStart(2, "0")}:00:00Z`,
  })),
);
export type Connection = {
  id: string;
  source: string;
  target: string;
  kind: "Device usage" | "Coordinated posting";
  evidence: string[];
  at: string;
  reason: string;
};
export const connections: Connection[] = [
  ...logins.map((l) => ({
    id: `LINK-${l.id}`,
    source: l.accountId,
    target: l.deviceId,
    kind: "Device usage" as const,
    evidence: [l.id],
    at: l.at,
    reason: devices.find((d) => d.id === l.deviceId)!.context,
  })),
  {
    id: "LINK-C1",
    source: "A-001",
    target: "A-002",
    kind: "Coordinated posting",
    evidence: ["C-410", "C-411", "C-412"],
    at: "2026-10-18T14:32:12Z",
    reason:
      "Three distinct accounts posted identical text to U-021 in 67 seconds. Authored scenario, not a SQL result.",
  },
  {
    id: "LINK-C2",
    source: "A-002",
    target: "A-003",
    kind: "Coordinated posting",
    evidence: ["C-410", "C-411", "C-412"],
    at: "2026-10-18T14:32:12Z",
    reason:
      "Same shared-target posting window. Correlation needs contextual review.",
  },
];
export const clusters = [
  {
    id: "CL-001",
    name: "Echo chamber",
    members: ["A-001", "A-002", "A-003"],
    commentIds: ["C-410", "C-411", "C-412"],
    description:
      "Identical replies directed to one fictional target within 67 seconds.",
    kind: "Behavioral scenario",
  },
  {
    id: "CL-002",
    name: "Shared library access",
    members: ["A-007", "A-008"],
    commentIds: ["C-501", "C-502"],
    description:
      "Shared device with different text and targets, posted 26 hours apart.",
    kind: "Benign control",
  },
];
export const statuses = [
  "Open",
  "Under review",
  "Needs more evidence",
  "Resolved",
  "Closed",
] as const;
export type CaseStatus = (typeof statuses)[number];
export type CaseRecord = {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  accountIds: string[];
  commentIds: string[];
  notes: { text: string; at: string }[];
  decision: string;
  updatedAt: string;
};
export const initialCases: CaseRecord[] = [
  {
    id: "SP-0100",
    title: "Echo chamber",
    description:
      "Review the shared-target scenario and its supporting records.",
    status: "Under review",
    accountIds: ["A-001", "A-002", "A-003"],
    commentIds: ["C-410", "C-411", "C-412", "C-352"],
    notes: [
      {
        text: "Check conversation context before deciding whether moderation is warranted.",
        at: "2026-10-18T15:00:00Z",
      },
    ],
    decision: "",
    updatedAt: "2026-10-18T15:00:00Z",
  },
  {
    id: "SP-0099",
    title: "Repeated outreach",
    description:
      "Compare promotion repetition with a benign reminder explanation.",
    status: "Needs more evidence",
    accountIds: ["A-004", "A-006"],
    commentIds: comments
      .filter((c) => ["A-004", "A-006"].includes(c.accountId))
      .map((c) => c.id),
    notes: [],
    decision: "",
    updatedAt: "2026-10-18T12:00:00Z",
  },
  {
    id: "SP-0098",
    title: "Shared access",
    description: "Negative control: public library device, unrelated activity.",
    status: "Open",
    accountIds: ["A-007", "A-008"],
    commentIds: ["C-501", "C-502"],
    notes: [],
    decision: "",
    updatedAt: "2026-10-18T11:00:00Z",
  },
];
export const defaultThresholds = {
  repetition: 5,
  windowMinutes: 30,
  coordinationAccounts: 3,
  coordinationSeconds: 90,
};
export type Thresholds = typeof defaultThresholds;
export const handle = (id: string) =>
  profiles.find((p) => p.id === id)?.handle ?? id;
export const stamp = (iso: string) =>
  new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
export const limitation =
  "All identities, content, associations and labels are synthetic. Signals are review aids, not proof of identity, intent or guilt. Human review is required.";

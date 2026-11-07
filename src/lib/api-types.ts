export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};
export type Account = {
  id: string;
  handle: string;
  bio: string;
  created_at: string;
  provenance_id: string;
  demo_score: number;
};
export type Label = {
  label_code: string;
  label_method: string;
  provenance_id: string;
};
export type Comment = {
  id: string;
  author_id: string;
  author_handle?: string;
  target_id: string;
  body: string;
  created_at: string;
  provenance_id: string;
  reviewed: boolean;
  labels: Label[];
  evidence?: Evidence[];
};
export type Evidence = {
  id: string;
  comment_id: string | null;
  login_id: string | null;
  interaction_id: string | null;
  record_type?: string;
  record?: Record<string, unknown>;
  body?: string;
  occurred_at?: string;
  account_id?: string;
  provenance_id?: string;
};
export type Finding = {
  id: string;
  run_id: string;
  rule_code: string;
  rule_version: number;
  account_id: string;
  anchor_comment_id: string;
  explanation: string;
  evidence?: Page<Evidence>;
};
export type Login = {
  id: string;
  account_id: string;
  device_id: string;
  occurred_at: string;
  display_name: string;
  context: string;
  evidence_id?: string;
};
export const caseStatuses = [
  "Open",
  "Under review",
  "Needs more evidence",
  "Resolved",
  "Closed",
] as const;
export type CaseStatus = (typeof caseStatuses)[number];
export type Case = {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  decision: string;
  updated_at: string;
  account_ids: string[];
  evidence_ids: string[];
  finding_ids: string[];
};
export type Note = {
  id: string;
  body: string;
  created_at: string;
  investigator_id: string;
};
export type Rule = {
  code: string;
  version: number;
  description: string;
  min_count: number;
  window_seconds: number;
  weight: number;
};
export type Overview = {
  counts: {
    comments: number;
    labeled_comments: number;
    reviewed_comments: number;
    open_cases: number;
  };
  timeline: { day: string; comments: number; labeled_comments: number }[];
  limitation: string;
  scope: string;
};
export type Report = {
  case: Case;
  evidence: Page<Evidence>;
  limitation: string;
  scope: string;
};

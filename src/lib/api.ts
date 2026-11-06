import type {
  CaseRecord,
  CommentRecord,
  Connection,
  Thresholds,
} from "./investigation-data";
import type { DemoState, Finding } from "./demo-engine";
import type { FlagEvent } from "./mock-data";

export type Profile = {
  id: string;
  handle: string;
  created: string;
  bio: string;
  devices: string[];
  score?: number;
  provenanceId?: string;
  provenanceKind?: string;
};
export type SqlFinding = Finding & {
  id: string;
  accountId: string;
  runId: string;
  anchorId: string;
};
export type WorkspaceData = {
  profiles: Profile[];
  comments: (CommentRecord & {
    annotations?: { category: string; method: string; provenanceId: string }[];
    provenanceId?: string;
    provenanceKind?: string;
    reviewed?: boolean;
  })[];
  devices: { id: string; name: string; context: string }[];
  logins: { id: string; accountId: string; deviceId: string; at: string }[];
  connections: Connection[];
  clusters: {
    id: string;
    name: string;
    members: string[];
    commentIds: string[];
    description: string;
    kind: string;
  }[];
  findings: SqlFinding[];
  state: DemoState;
  events: FlagEvent[];
  activity: { day: number; label: string; analyzed: number; flagged: number }[];
  accounts: {
    name: string;
    initials: string;
    signals: number;
    priority: string;
  }[];
  settings: {
    database: string;
    rules: {
      code: string;
      version: number;
      description: string;
      min_count: number;
      window_seconds: number;
      weight: number;
    }[];
    provenance: {
      id: string;
      kind: string;
      name: string;
      version: string;
      description: string;
      source_url: string | null;
      license_text: string;
    }[];
    thresholdsEditable: boolean;
    limitation: string;
  };
  dashboard: {
    accounts: number;
    comments: number;
    annotatedComments: number;
    detectedComments: number;
    findings: number;
    openCases: number;
    riskBreakdown: Record<string, number>;
    periodEnd: string;
  };
};

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(30000);
  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Shadowprint-Client": "local-workspace",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(
      "API unavailable or request timed out. Check FastAPI and SQL Server, then retry. If a save timed out, refresh before resubmitting.",
    );
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(
      typeof problem?.detail === "string"
        ? problem.detail
        : "The request was rejected. Check the fields and try again.",
    );
  }
  return response.json() as Promise<T>;
}
export function caseBody(c: CaseRecord) {
  return {
    title: c.title,
    description: c.description,
    accountIds: c.accountIds,
    commentIds: c.commentIds,
  };
}
export function groupedFindings(data: WorkspaceData, id: string): Finding[] {
  const groups = new Map<string, Finding>();
  for (const f of data.findings.filter((f) => f.accountId === id)) {
    const previous = groups.get(f.rule);
    groups.set(f.rule, {
      rule: f.rule,
      reason: previous ? previous.reason : f.reason,
      weight: f.weight,
      commentIds: [
        ...new Set([...(previous?.commentIds ?? []), ...f.commentIds]),
      ],
    });
  }
  return [...groups.values()].map((f) => {
    const windows = data.findings.filter(
      (item) => item.accountId === id && item.rule === f.rule,
    ).length;
    return {
      ...f,
      reason:
        windows > 1
          ? windows +
            " qualifying SQL windows; " +
            f.commentIds.length +
            " distinct supporting comments. This rule contributes its weight once. Review context."
          : f.reason,
    };
  });
}

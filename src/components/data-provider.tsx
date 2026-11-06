"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import * as fixture from "@/lib/investigation-data";
import * as mock from "@/lib/mock-data";
import { initialState } from "@/lib/demo-engine";
import { DemoContext } from "./demo-provider";
import { request, caseBody, type WorkspaceData } from "@/lib/api";
import { Button } from "./ui/button";

const legacy: WorkspaceData = {
  profiles: fixture.profiles,
  comments: fixture.comments,
  devices: fixture.devices,
  logins: fixture.logins,
  connections: fixture.connections,
  clusters: fixture.clusters,
  findings: [],
  state: initialState(),
  events: mock.events,
  activity: mock.activity,
  accounts: mock.accounts,
  settings: {
    database: "",
    rules: [],
    provenance: [],
    thresholdsEditable: true,
    limitation: fixture.limitation,
  },
  dashboard: {
    accounts: 9,
    comments: 28,
    annotatedComments: 25,
    detectedComments: 24,
    findings: 11,
    openCases: 3,
    riskBreakdown: {},
    periodEnd: "2026-10-18",
  },
};
const DataContext = createContext<WorkspaceData | null>(null);
type Live = {
  busy: boolean;
  refresh: () => Promise<void>;
  saveCase: (c: fixture.CaseRecord) => Promise<fixture.CaseRecord>;
  addNote: (id: string, text: string) => Promise<void>;
  review: (id: string, reviewed: boolean) => Promise<void>;
  runDetection: () => Promise<void>;
};
const LiveContext = createContext<Live | null>(null);
export const useLive = () => useContext(LiveContext);
export function useDataset() {
  const data = useContext(DataContext) ?? legacy;
  return {
    ...data,
    handle: (id: string) =>
      data.profiles.find((p) => p.id === id)?.handle ?? id,
  };
}
export function SqlProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const activeMutation = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const next = await request<WorkspaceData>("/api/workspace");
      setData(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed.");
      throw e;
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    request<WorkspaceData>(
      "/api/workspace",
      "GET",
      undefined,
      controller.signal,
    )
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function mutate<T>(fn: () => Promise<T>): Promise<T> {
    if (activeMutation.current)
      throw new Error("A save is already in progress.");
    activeMutation.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      await refresh();
      return result;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Save failed. Refresh before retrying.",
      );
      throw e;
    } finally {
      activeMutation.current = false;
      setBusy(false);
    }
  }
  const live: Live = {
    busy,
    refresh,
    saveCase: (c) =>
      mutate(async () => {
        if (!c.id)
          return request<fixture.CaseRecord>("/api/cases", "POST", {
            ...caseBody(c),
            status: c.status,
            decision: c.decision,
          });
        const original = data?.state.cases.find((r) => r.id === c.id);
        let saved = c;
        if (
          !original ||
          JSON.stringify(caseBody(original)) !== JSON.stringify(caseBody(c))
        )
          saved = await request<fixture.CaseRecord>(
            "/api/cases/" + encodeURIComponent(c.id),
            "PUT",
            caseBody(c),
          );
        if (
          !original ||
          original.status !== c.status ||
          original.decision !== c.decision
        ) {
          try {
            saved = await request<fixture.CaseRecord>(
              "/api/cases/" + encodeURIComponent(c.id) + "/status",
              "PATCH",
              { status: c.status, decision: c.decision },
            );
          } catch {
            throw new Error(
              "Case details may have saved, but status was not confirmed. Refresh to check before retrying.",
            );
          }
        }
        return saved;
      }),
    addNote: (id, text) =>
      mutate(async () => {
        await request(
          "/api/cases/" + encodeURIComponent(id) + "/notes",
          "POST",
          { text },
        );
      }),
    review: (id, reviewed) =>
      mutate(async () => {
        await request(
          "/api/comments/" + encodeURIComponent(id) + "/review",
          "POST",
          {
            reviewed,
            reason: reviewed
              ? "Reviewed by local investigator; inspect case notes for context."
              : "Reopened for further review.",
          },
        );
      }),
    runDetection: () =>
      mutate(async () => {
        await request("/api/detection/runs", "POST");
      }),
  };
  const retry = async () => {
    setLoading(true);
    try {
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  if (!data)
    return (
      <main className="panel" style={{ margin: "10vh auto", maxWidth: 680 }}>
        <h1>SHADOWPRINT</h1>
        {loading ? (
          <p role="status">Connecting to the investigation database…</p>
        ) : (
          <>
            <p role="alert">{error}</p>
            <Button onClick={retry}>Retry connection</Button>
          </>
        )}
      </main>
    );
  return (
    <DataContext.Provider value={data}>
      <LiveContext.Provider value={live}>
        <DemoContext.Provider
          value={{
            state: data.state,
            ready: true,
            storageError: "",
            update: () =>
              setError("Use the database-backed action for this change."),
          }}
        >
          {error && (
            <div className="callout" role="alert">
              {error} <button onClick={retry}>Refresh database state</button>
            </div>
          )}
          {busy && (
            <div className="callout" role="status">
              Saving to SQL Server…
            </div>
          )}
          {children}
        </DemoContext.Provider>
      </LiveContext.Provider>
    </DataContext.Provider>
  );
}

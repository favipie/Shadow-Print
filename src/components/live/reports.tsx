"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, useApi, link, stamp } from "@/lib/api-client";
import type { Case, Report, Note, Page, Evidence } from "@/lib/api-types";
import { Head, Load, Paged, EvidenceCard, Action } from "./common";
async function completeReport(id: string) {
  const first = await api<Report>(`cases/${id}/report?limit=100`);
  const evidence: Evidence[] = [...first.evidence.items];
  for (let offset = 100; offset < first.evidence.total; offset += 100) {
    const next = await api<Report>(
      `cases/${id}/report?limit=100&offset=${offset}`,
    );
    evidence.push(...next.evidence.items);
  }
  const notes: Note[] = [];
  let total = 1;
  for (let offset = 0; offset < total; offset += 100) {
    const next = await api<Page<Note>>(
      `cases/${id}/notes?limit=100&offset=${offset}`,
    );
    total = next.total;
    notes.push(...next.items);
  }
  return { ...first, evidence: { ...first.evidence, items: evidence }, notes };
}
function ReportView({ id }: { id: string }) {
  const [offset, setOffset] = useState(0);
  const result = useApi<Report>(`cases/${id}/report?limit=20&offset=${offset}`);
  const [printData, setPrintData] = useState<Awaited<
    ReturnType<typeof completeReport>
  > | null>(null);
  return (
    <section className="panel report-sheet printable-report">
      <Load {...result} />
      {result.data && (
        <>
          <Head title="Investigation report" label={id} />
          <h2>{result.data.case.title}</h2>
          <p>{result.data.case.description}</p>
          <div className="mini-stats">
            <div>
              <strong>{result.data.case.status}</strong>
              <small>Status</small>
            </div>
            <div>
              <strong>{result.data.evidence.total}</strong>
              <small>Explicit evidence associations</small>
            </div>
          </div>
          <div className="callout">
            <strong>Decision</strong>
            <p>{result.data.case.decision || "No decision recorded."}</p>
          </div>
          <p>{result.data.limitation}</p>
          <div className="action-row print-actions">
            <Action
              run={async () => {
                const full = await completeReport(id);
                const csv = [
                  ["Evidence", "Comment", "Account", "UTC timestamp", "Text"],
                  ...full.evidence.items.map((e) => [
                    e.id,
                    e.comment_id ?? "",
                    e.account_id ?? "",
                    e.occurred_at ?? "",
                    e.body ?? "",
                  ]),
                ]
                  .map((row) =>
                    row
                      .map(
                        (v) =>
                          `"${(/^[\s]*[=+\-@]/.test(v) ? "'" + v : v).replaceAll('"', '""')}"`,
                      )
                      .join(","),
                  )
                  .join("\r\n");
                const url = URL.createObjectURL(
                  new Blob(["\uFEFF" + csv], {
                    type: "text/csv;charset=utf-8",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = `${id}-evidence.csv`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Export evidence CSV
            </Action>
            <Action
              run={async () => {
                setPrintData(await completeReport(id));
              }}
            >
              Prepare complete printable report
            </Action>
            {printData && (
              <Button onClick={() => window.print()}>Print / Save PDF</Button>
            )}
          </div>
          <div className={printData ? "screen-only" : ""}>
            <Head title="Evidence timeline" />
            {result.data.evidence.items.map((e) => (
              <article className="note" key={e.id}>
                <strong>
                  {e.id} · {e.comment_id ?? e.login_id ?? e.interaction_id}
                </strong>
                <p>{e.body}</p>
                <small>
                  {e.occurred_at && stamp(e.occurred_at)} · {e.provenance_id}
                </small>
                <EvidenceCard id={e.id} />
              </article>
            ))}
            <div className="action-row print-actions">
              <Button
                variant="outline"
                disabled={!offset}
                onClick={() => setOffset(offset - 20)}
              >
                Previous evidence
              </Button>
              <span>
                {offset + result.data.evidence.items.length} of{" "}
                {result.data.evidence.total}
              </span>
              <Button
                variant="outline"
                disabled={offset + 20 >= result.data.evidence.total}
                onClick={() => setOffset(offset + 20)}
              >
                Next evidence
              </Button>
            </div>
            <Head title="Investigator notes" />
            <Paged<Note>
              path={`cases/${id}/notes`}
              label="notes"
              render={(n) => (
                <article className="note" key={n.id}>
                  <p>{n.body}</p>
                  <small>
                    {stamp(n.created_at)} · {n.investigator_id}
                  </small>
                </article>
              )}
            />
          </div>
          {printData && (
            <div className="print-complete">
              <Head title="Complete evidence timeline" />
              {printData.evidence.items.map((e) => (
                <article className="note" key={e.id}>
                  <b>{e.id}</b>
                  <p>
                    {e.body ??
                      `${e.login_id ?? e.interaction_id} · ${e.account_id}`}
                  </p>
                  <small>
                    {e.occurred_at} · {e.provenance_id}
                  </small>
                </article>
              ))}
              <Head title="All investigator notes" />
              {printData.notes.map((n) => (
                <article className="note" key={n.id}>
                  <p>{n.body}</p>
                  <small>
                    {n.created_at} · {n.investigator_id}
                  </small>
                </article>
              ))}
            </div>
          )}
          <small>
            Updated {stamp(result.data.case.updated_at)} · {result.data.scope}
          </small>
        </>
      )}
    </section>
  );
}
export default function ReportsScreen({ params }: { params: URLSearchParams }) {
  const id = params.get("case");
  return (
    <div className="screen-grid reports-layout">
      <aside className="panel directory print-actions">
        <Head title="Report scope" />
        <Paged<Case>
          path="cases"
          label="cases"
          render={(c) => (
            <a
              key={c.id}
              className="directory-item"
              href={link("reports", "case", c.id)}
            >
              <span>
                <strong>{c.title}</strong>
                <small>
                  {c.id} · {c.status}
                </small>
              </span>
            </a>
          )}
        />
      </aside>
      {id ? (
        <ReportView key={id} id={id} />
      ) : (
        <section className="panel">
          Choose a case to generate its report.
        </section>
      )}
    </div>
  );
}

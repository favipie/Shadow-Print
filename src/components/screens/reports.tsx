"use client";
import { useState } from "react";
import { useDataset, useLive } from "@/components/data-provider";
import { API_BASE, groupedFindings } from "@/lib/api";
import { Printer, Download } from "lucide-react";
import { comments, handle, limitation, stamp } from "@/lib/investigation-data";
import {
  analyzeAccount,
  csvText,
  download,
  route,
  scorePriority,
} from "@/lib/demo-engine";
import { useDemo } from "@/components/demo-provider";
import { Button } from "@/components/ui/button";
import { AccountLink, Empty, EvidenceRows, Field, SectionHead } from "./shared";
export default function ReportsScreen({ params }: { params: URLSearchParams }) {
  const data = useDataset();
  const { comments, handle } = data;
  const live = useLive();
  const { state } = useDemo();
  const [notice, setNotice] = useState("");
  const selected = state.cases.find(
    (c) => c.id === (params.get("case") ?? state.cases[0]?.id),
  );
  if (!selected)
    return (
      <section className="panel">
        <Empty title="No matching case report">
          <a href="#reports">Choose another case</a>
        </Empty>
      </section>
    );
  const ids = [
    ...new Set([
      ...selected.accountIds,
      ...comments
        .filter((c) => selected.commentIds.includes(c.id))
        .map((c) => c.accountId),
    ]),
  ];
  const findings = ids.flatMap((id) =>
    (live
      ? groupedFindings(data, id)
      : analyzeAccount(id, state.thresholds)
    ).map((f) => ({ ...f, accountId: id })),
  );
  const maxScore = Math.max(
    0,
    ...ids.map((id) =>
      live
        ? (data.profiles.find((p) => p.id === id)?.score ?? 0)
        : analyzeAccount(id, state.thresholds).reduce(
            (n, f) => n + f.weight,
            0,
          ),
    ),
  );
  const records = comments
    .filter((c) => selected.commentIds.includes(c.id))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  function exportReport() {
    if (!selected) return;
    if (live) {
      window.location.assign(
        API_BASE +
          "/api/reports/" +
          encodeURIComponent(selected.id) +
          "?format=csv",
      );
      return;
    }
    const fields = [
      selected.id,
      selected.title,
      selected.status,
      selected.description,
      scorePriority(maxScore),
      selected.decision,
      selected.notes.map((n) => `${n.at}: ${n.text}`).join(" | "),
      limitation,
    ];
    download(
      selected.id + "-report.csv",
      csvText([
        [
          "Case",
          "Title",
          "Status",
          "Description",
          "Priority",
          "Decision",
          "Notes",
          "Limitations",
          "Comment",
          "Account",
          "Target",
          "Text",
          "Category",
          "Source",
          "UTC",
        ],
        ...(records.length
          ? records.map((c) => [
              ...fields,
              c.id,
              handle(c.accountId),
              handle(c.targetId),
              c.text,
              c.category,
              c.source,
              c.at,
            ])
          : [[...fields, "", "", "", "", "", "", ""]]),
      ]),
    );
    setNotice("Case report exported as CSV.");
  }
  return (
    <div className="screen-stack">
      <section className="panel report-controls">
        <div className="action-row">
          <Field label="Select investigation">
            <select
              value={selected.id}
              onChange={(e) =>
                (window.location.hash = route(
                  "reports",
                  "case",
                  e.target.value,
                ))
              }
            >
              {state.cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.title}
                </option>
              ))}
            </select>
          </Field>
          <Button onClick={exportReport}>
            <Download size={15} />
            Download report CSV
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              live
                ? window.open(
                    API_BASE +
                      "/api/reports/" +
                      encodeURIComponent(selected.id) +
                      "?format=html",
                    "_blank",
                    "noopener,noreferrer",
                  )
                : window.print()
            }
          >
            <Printer size={15} />
            Print report
          </Button>
          <a className="text-link" href={route("cases", "case", selected.id)}>
            Return to case
          </a>
        </div>
        {notice && (
          <p role="status" className="success-note">
            {notice}
          </p>
        )}
      </section>
      <article className="panel printable-report">
        <header className="report-header">
          <span className="eyebrow">
            SHADOWPRINT / INVESTIGATION SUMMARY / SYNTHETIC DEMO
          </span>
          <h2>{selected.title}</h2>
          <p>
            {selected.id} · {selected.status}
          </p>
          <small>
            Case updated {stamp(selected.updatedAt)} · Rule version v1 · current
            {live ? "SQL thresholds" : "browser thresholds"}
          </small>
        </header>
        <section>
          <h3>Investigation scope</h3>
          <p>{selected.description}</p>
          <div className="action-row">
            {ids.map((id) => (
              <AccountLink key={id} id={id} />
            ))}
          </div>
          <p>
            Review priority: <strong>{scorePriority(maxScore)}</strong> ·
            highest associated account score: {maxScore}/100. Scores are review
            heuristics, not probabilities.
          </p>
        </section>
        <section>
          <h3>Detected patterns</h3>
          <p className="subtle">
            Computed across each associated account’s full source history, which
            may include records beyond this case’s evidence register.
          </p>
          {findings.length ? (
            findings.map((f) => (
              <div className="report-finding" key={f.accountId + f.rule}>
                <strong>
                  @{handle(f.accountId)} · {f.rule} (+{f.weight})
                </strong>
                <p>{f.reason}</p>
                <small>Supporting records: {f.commentIds.join(", ")}</small>
              </div>
            ))
          ) : (
            <p>No configured rules triggered.</p>
          )}
        </section>
        <section>
          <h3>Evidence & chronological timeline</h3>
          {records.length ? (
            <EvidenceRows ids={records.map((c) => c.id)} />
          ) : (
            <p>No comment records attached.</p>
          )}
        </section>
        <section>
          <h3>Investigator notes</h3>
          {selected.notes.length ? (
            selected.notes.map((n, i) => (
              <div className="note" key={i}>
                <p>{n.text}</p>
                <small>{stamp(n.at)}</small>
              </div>
            ))
          ) : (
            <p>No notes recorded.</p>
          )}
        </section>
        <section>
          <h3>Decision</h3>
          <p>{selected.decision || "No decision recorded."}</p>
        </section>
        <section>
          <h3>Limitations & uncertainty</h3>
          <p>{limitation}</p>
          <p>
            Labels are authored examples. Shared devices are not identity
            evidence. Benign repetitions and shared networks can produce false
            positives.{" "}
            {live
              ? "SQL rules use supplied annotations; no production classifier is claimed."
              : "No production classifier or SQL engine is connected."}
          </p>
          <small>
            Thresholds: repetition ≥{state.thresholds.repetition} in{" "}
            {state.thresholds.windowMinutes} min; coordination ≥
            {state.thresholds.coordinationAccounts} accounts in{" "}
            {state.thresholds.coordinationSeconds}s.
          </small>
        </section>
      </article>
    </div>
  );
}

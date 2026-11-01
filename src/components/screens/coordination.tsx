"use client";
import { useState } from "react";
import { clusters, comments, handle, stamp } from "@/lib/investigation-data";
import { coordinationEvidence, route } from "@/lib/demo-engine";
import { useDemo } from "@/components/demo-provider";
import { Button } from "@/components/ui/button";
import { AccountLink, Empty, EvidenceRows, Field, SectionHead } from "./shared";
export default function CoordinationScreen() {
  const { state } = useDemo();
  const [selected, setSelected] = useState("CL-001");
  const [filter, setFilter] = useState("All scenarios");
  const group = clusters.find((c) => c.id === selected)!;
  const matching = coordinationEvidence(state.thresholds);
  const qualifies = group.commentIds.some((id) =>
    matching.some((c) => c.id === id),
  );
  const records = comments
    .filter((c) => group.commentIds.includes(c.id))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const rows = clusters.filter(
    (c) => filter === "All scenarios" || c.kind === filter,
  );
  return (
    <div className="screen-stack">
      <div className="callout">
        Frontend scenario analysis · COORD-01 v1. Requires identical normalized
        text, the same target, at least {state.thresholds.coordinationAccounts}{" "}
        accounts and a {state.thresholds.coordinationSeconds}-second window.
      </div>
      <div className="screen-grid">
        <aside className="panel">
          <SectionHead
            label="KNOWN FIXTURE SCENARIOS"
            title="Activity groups"
          />
          <Field label="Scenario type">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option>All scenarios</option>
              <option>Behavioral scenario</option>
              <option>Benign control</option>
            </select>
          </Field>
          {rows.map((c) => (
            <button
              className={
                "directory-item " + (selected === c.id ? "selected" : "")
              }
              key={c.id}
              onClick={() => setSelected(c.id)}
            >
              <span>
                <strong>{c.name}</strong>
                <small>
                  {c.id} · {c.members.length} accounts · {c.kind}
                </small>
              </span>
            </button>
          ))}
          {!rows.length && <Empty />}
        </aside>
        <div className="screen-stack">
          <section className="panel">
            <SectionHead
              label={group.id + " / " + group.kind.toUpperCase()}
              title={group.name}
            />
            <p className="subtle">{group.description}</p>
            <div className="analysis-result">
              <strong>{qualifies ? "MATCH" : "NO MATCH"}</strong>
              <span>
                {qualifies ? "Review priority: Medium" : "Review priority: Low"}
                <small>
                  {qualifies
                    ? "One behavioral rule triggered; no identity conclusion."
                    : "Current coordination rule does not trigger for this group."}
                </small>
              </span>
            </div>
            <div className="mini-stats">
              <div>
                <strong>{group.members.length}</strong>
                <small>Accounts</small>
              </div>
              <div>
                <strong>{records.length}</strong>
                <small>Comment records</small>
              </div>
              <div>
                <strong>{new Set(records.map((c) => c.targetId)).size}</strong>
                <small>Distinct targets</small>
              </div>
              <div>
                <strong>
                  {Math.round(
                    (Date.parse(records.at(-1)!.at) -
                      Date.parse(records[0].at)) /
                      1000,
                  )}
                  s
                </strong>
                <small>Observed span</small>
              </div>
            </div>
            <div className="action-row">
              {group.members.map((id) => (
                <AccountLink key={id} id={id} />
              ))}
            </div>
            <div className="action-row">
              <Button asChild>
                <a href={route("network", "account", group.members[0])}>
                  Explore network
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={route("cases", "cluster", group.id)}>
                  Add group to case
                </a>
              </Button>
            </div>
          </section>
          <section className="panel">
            <SectionHead
              label="CHRONOLOGICAL EVIDENCE · UTC"
              title="Activity timeline"
            />
            <EvidenceRows ids={records.map((c) => c.id)} />
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useDataset, useLive } from "@/components/data-provider";
import { groupedFindings } from "@/lib/api";
import { Network, ScanLine, ShieldCheck } from "lucide-react";
import {
  profiles,
  comments,
  devices,
  logins,
  handle,
  stamp,
} from "@/lib/investigation-data";
import { analyzeAccount, route, scorePriority } from "@/lib/demo-engine";
import { useDemo } from "@/components/demo-provider";
import { Button } from "@/components/ui/button";
import {
  AccountLink,
  CaseLink,
  Empty,
  EvidenceRows,
  SearchField,
  SectionHead,
} from "./shared";
export default function AccountScreen({ params }: { params: URLSearchParams }) {
  const data = useDataset();
  const { profiles, comments, devices, logins, handle } = data;
  const live = useLive();
  const { state } = useDemo();
  const [search, setSearch] = useState("");
  const [ran, setRan] = useState<string | null>(null);
  const id = params.get("account") ?? profiles[0]?.id;
  const selected = profiles.find((p) => p.id === id);
  const list = profiles.filter((p) =>
    `${p.handle} ${p.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  if (!selected)
    return (
      <section className="panel">
        <Empty title="Account not found">
          This fictional account does not exist.{" "}
          <a className="text-link" href="#accounts">
            Browse accounts
          </a>
        </Empty>
      </section>
    );
  const own = comments
    .filter((c) => c.accountId === id)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const findings = live
    ? groupedFindings(data, id!)
    : analyzeAccount(id!, state.thresholds);
  const score = live
    ? (selected.score ?? 0)
    : findings.reduce((n, f) => n + f.weight, 0);
  const analysisKey = id + JSON.stringify(state.thresholds);
  const related = profiles.filter(
    (p) => p.id !== id && p.devices.some((d) => selected.devices.includes(d)),
  );
  return (
    <div className="screen-grid">
      <aside className="panel directory">
        <SectionHead label="FICTIONAL ACCOUNTS" title="Account directory" />
        <SearchField
          value={search}
          onChange={setSearch}
          label="Search account or ID"
        />
        <p className="subtle">
          {list.length} of {profiles.length} accounts
        </p>
        {list.length ? (
          list.map((p) => (
            <a
              key={p.id}
              href={route("accounts", "account", p.id)}
              className={"directory-item " + (id === p.id ? "selected" : "")}
              aria-current={id === p.id ? "true" : undefined}
            >
              <span className="avatar">
                {p.handle.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>@{p.handle}</strong>
                <small>{p.id}</small>
              </span>
            </a>
          ))
        ) : (
          <Empty />
        )}
      </aside>
      <div className="screen-stack">
        <section className="panel account-summary">
          <div className="split-title">
            <div>
              <span className="eyebrow">{id} / FICTIONAL IDENTITY</span>
              <h2>@{selected.handle}</h2>
              <p>{selected.bio}</p>
            </div>
            <span className="large-avatar">
              <ShieldCheck size={32} />
            </span>
          </div>
          <div className="mini-stats">
            <div>
              <strong>{own.length}</strong>
              <small>Comment records</small>
            </div>
            <div>
              <strong>{selected.devices.length}</strong>
              <small>Demo devices</small>
            </div>
            <div>
              <strong>{new Set(own.map((c) => c.targetId)).size}</strong>
              <small>Targets in source data</small>
            </div>
            <div>
              <strong>{selected.created}</strong>
              <small>Account created</small>
            </div>
          </div>
          <div className="action-row">
            <Button
              disabled={live?.busy}
              onClick={async () => {
                if (live) {
                  try {
                    await live.runDetection();
                  } catch {
                    return;
                  }
                }
                setRan(analysisKey);
              }}
            >
              <ScanLine size={15} />
              {live ? "Run SQL detection" : "Run demo analysis"}
            </Button>
            <Button asChild variant="outline">
              <a href={route("network", "account", id)}>
                <Network size={15} />
                Open network
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={route("threats", "account", id)}>View comments</a>
            </Button>
            <CaseLink accountId={id} />
          </div>
        </section>
        <section className="panel">
          <SectionHead
            label={
              live
                ? "EXPLAINABLE SQL RULES · V1"
                : "EXPLAINABLE FRONTEND RULES · V1"
            }
            title="Investigation findings"
          />
          {!live && ran !== analysisKey ? (
            <div className="callout">
              Run demo analysis to evaluate this account against the current
              thresholds. This evaluates local records only.
            </div>
          ) : (
            <>
              <div className="analysis-result" role="status">
                <strong>{score} / 100</strong>
                <span>
                  {scorePriority(score)} review priority · {findings.length}{" "}
                  triggered rules
                  <br />
                  <small>
                    Weighted heuristic, not a probability. Shared devices
                    contribute zero points.
                  </small>
                </span>
              </div>
              {findings.length ? (
                findings.map((f) => (
                  <details className="finding" key={f.rule}>
                    <summary>
                      <b>{f.rule}</b>
                      <span>{f.reason}</span>
                      <strong>+{f.weight}</strong>
                    </summary>
                    <EvidenceRows ids={f.commentIds} />
                  </details>
                ))
              ) : (
                <div className="callout">
                  No configured rules triggered. Absence of a signal does not
                  establish safety.
                </div>
              )}
            </>
          )}
        </section>
        <section className="panel">
          <SectionHead
            label="ASSOCIATIONS / CONTEXT REQUIRED"
            title="Devices & connected accounts"
          />
          {selected.devices.length ? (
            selected.devices.map((d) => (
              <div className="device-row" key={d}>
                <strong>
                  {d} · {devices.find((v) => v.id === d)?.name}
                </strong>
                <p>{devices.find((v) => v.id === d)?.context}</p>
                {logins
                  .filter((l) => l.accountId === id && l.deviceId === d)
                  .map((l) => (
                    <small key={l.id}>
                      {l.id} · {stamp(l.at)}
                    </small>
                  ))}
              </div>
            ))
          ) : (
            <p className="subtle">No device association in the source data.</p>
          )}
          <div className="action-row">
            {related.map((p) => (
              <AccountLink key={p.id} id={p.id} />
            ))}
          </div>
          {related.length === 0 && (
            <p className="subtle">No shared-device accounts in the demo.</p>
          )}
        </section>
        <section className="panel">
          <SectionHead
            label="ORIGINAL FIXTURE RECORDS · UTC"
            title="Activity timeline"
          />
          {own.length ? (
            <EvidenceRows ids={own.map((c) => c.id)} />
          ) : (
            <Empty title="No comment activity" />
          )}
        </section>
      </div>
    </div>
  );
}

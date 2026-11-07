"use client";
import { useDeferredValue, useState } from "react";
import { useApi, query, link, stamp } from "@/lib/api-client";
import type { Account, Comment, Finding, Login } from "@/lib/api-types";
import {
  Head,
  Field,
  Load,
  Paged,
  CommentRow,
  AccountLink,
  EvidenceCard,
} from "./common";
function FindingRow({ item }: { item: Finding }) {
  const [open, setOpen] = useState(false);
  const result = useApi<Finding>(open ? `findings/${item.id}` : null);
  return (
    <article className="finding">
      <button onClick={() => setOpen(!open)} aria-expanded={open}>
        <b>{item.rule_code}</b> · {item.explanation}
      </button>
      <small>
        Run {item.run_id} · version {item.rule_version}
      </small>
      {open && (
        <>
          <Load {...result} />
          {result.data && (
            <Paged<import("@/lib/api-types").Evidence>
              path={`findings/${item.id}/evidence`}
              render={(e) => <EvidenceCard key={e.id} id={e.id} />}
            />
          )}
        </>
      )}
    </article>
  );
}
export default function AccountsScreen({
  params,
}: {
  params: URLSearchParams;
}) {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const id = params.get("account");
  const result = useApi<Account>(id ? `accounts/${id}` : null);
  return (
    <div className="screen-grid">
      <aside className="panel directory">
        <Head title="Account directory" />
        <Field label="Search account or ID">
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Paged<Account>
          path={`accounts?${query({ q: deferred })}`}
          label="accounts"
          render={(a) => (
            <a
              key={a.id}
              className={`directory-item ${a.id === id ? "selected" : ""}`}
              href={link("accounts", "account", a.id)}
            >
              <span className="avatar">
                {a.handle.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>@{a.handle}</strong>
                <small>
                  {a.id} · score {a.demo_score}
                </small>
              </span>
            </a>
          )}
        />
      </aside>
      <div className="screen-stack">
        <Load {...result} />
        {!id && (
          <section className="panel">
            <p>
              Select an account to inspect its original activity and persisted
              findings.
            </p>
          </section>
        )}
        {result.data && (
          <>
            <section className="panel account-summary">
              <Head
                title={`@${result.data.handle}`}
                label={`${id} / ${result.data.provenance_id}`}
              />
              <p>{result.data.bio}</p>
              <div className="mini-stats">
                <div>
                  <strong>{result.data.demo_score} / 100</strong>
                  <small>Current SQL rule score</small>
                </div>
                <div>
                  <strong>{stamp(result.data.created_at)}</strong>
                  <small>Account created</small>
                </div>
              </div>
              <div className="action-row">
                <a className="text-link" href={link("network", "account", id!)}>
                  Open network
                </a>
                <a className="text-link" href={link("threats", "account", id!)}>
                  View comments
                </a>
                <a className="text-link" href={link("cases", "account", id!)}>
                  Add to case
                </a>
              </div>
            </section>
            <section className="panel">
              <Head
                title="Investigation findings"
                label="PERSISTED SQL DETECTION RESULTS"
              />
              <Paged<Finding>
                path={`accounts/${id}/findings`}
                label="findings"
                render={(f) => <FindingRow key={f.id} item={f} />}
              />
            </section>
            <section className="panel">
              <Head title="Devices & connected accounts" />
              <Paged<Login>
                path={`accounts/${id}/logins`}
                label="device observations"
                render={(l) => (
                  <article key={l.id}>
                    <strong>
                      {l.device_id} · {l.display_name}
                    </strong>
                    <p>{l.context}</p>
                    <small>
                      {l.id} · {stamp(l.occurred_at)}
                    </small>
                  </article>
                )}
              />
              <Paged<Account>
                path={`accounts/${id}/related`}
                label="related accounts"
                render={(a) => (
                  <article key={a.id}>
                    <AccountLink id={a.id} name={a.handle} />
                    <p>
                      Shared device association; not evidence of common
                      identity.
                    </p>
                  </article>
                )}
              />
            </section>
            <section className="panel">
              <Head title="Activity timeline" />
              <Paged<Comment>
                path={`comments?account_id=${id}`}
                label="comments"
                render={(c) => <CommentRow key={c.id} item={c} />}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

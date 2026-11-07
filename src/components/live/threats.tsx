"use client";
import { useDeferredValue, useState } from "react";
import { useApi, writeApi, query, link, stamp } from "@/lib/api-client";
import type { Comment } from "@/lib/api-types";
import {
  Head,
  Field,
  Load,
  Paged,
  CommentRow,
  AccountLink,
  EvidenceCard,
  Action,
} from "./common";
function Detail({ id }: { id: string }) {
  const result = useApi<Comment>(`comments/${id}`);
  const [reason, setReason] = useState(
    "Inspected original evidence and context in SHADOWPRINT.",
  );
  return (
    <section className="panel">
      <Head title={`Original comment ${id}`} />
      <Load {...result} />
      {result.data && (
        <>
          <p className="case-description">{result.data.body}</p>
          <div className="action-row">
            <AccountLink id={result.data.author_id} />
            <span>→ {result.data.target_id}</span>
            <time>{stamp(result.data.created_at)}</time>
          </div>
          <p>{result.data.provenance_id}</p>
          {result.data.labels.map((l) => (
            <p key={l.label_code + l.provenance_id} className="source-label">
              {l.label_code} · {l.label_method} · {l.provenance_id}
            </p>
          ))}
          <div className="action-row">
            <a
              className="text-link"
              href={link("accounts", "account", result.data.author_id)}
            >
              Investigate account
            </a>
            <a
              className="text-link"
              href={link("network", "account", result.data.author_id)}
            >
              Open network
            </a>
            <a className="text-link" href={link("cases", "comment", id)}>
              Add to case
            </a>
          </div>
          {result.data.evidence?.map((e) => (
            <EvidenceCard key={e.id} id={e.id} />
          ))}
          <Field label="Review reason">
            <textarea
              maxLength={5000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Action
            disabled={!reason.trim()}
            run={() =>
              writeApi(`comments/${id}/reviews`, {
                reviewed: !result.data!.reviewed,
                reason,
              })
            }
          >
            {result.data.reviewed ? `Undo review ${id}` : `Mark reviewed ${id}`}
          </Action>
          <p role="status">
            {result.data.reviewed
              ? "Reviewed — saved in SQL Server"
              : "Awaiting review"}
          </p>
        </>
      )}
    </section>
  );
}
export default function ThreatsScreen({ params }: { params: URLSearchParams }) {
  const [search, setSearch] = useState(params.get("comment") ?? "");
  const deferred = useDeferredValue(search);
  const [category, setCategory] = useState("");
  const [reviewed, setReviewed] = useState("");
  const [source, setSource] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const path = `comments?${query({ q: deferred, category, reviewed, label_method: source, account_id: params.get("account") ?? "", since: since ? since + "T00:00:00Z" : "", until: until ? until + "T23:59:59.999Z" : "" })}`;
  return (
    <div className="screen-stack">
      <section className="panel">
        <Head title="Threat monitor" />
        <div className="live-filters">
          <Field label="Search comment or account">
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {[
                "Spam",
                "Repeated harassment",
                "Coordinated targeting",
                "Threat-related language",
                "Toxic or insulting content",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Review state">
            <select
              value={reviewed}
              onChange={(e) => setReviewed(e.target.value)}
            >
              <option value="">All reviews</option>
              <option value="false">Unreviewed</option>
              <option value="true">Reviewed</option>
            </select>
          </Field>
          <Field label="Annotation source">
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">All sources</option>
              {[
                "Authored label",
                "Rule example",
                "Public dataset",
                "Human review",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="From date (UTC)">
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </Field>
          <Field label="Through date (UTC)">
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </Field>
        </div>
        <Paged<Comment>
          path={path}
          label="comments"
          render={(c) => <CommentRow key={c.id} item={c} />}
        />
      </section>
      {params.get("comment") && (
        <Detail key={params.get("comment")} id={params.get("comment")!} />
      )}
    </div>
  );
}

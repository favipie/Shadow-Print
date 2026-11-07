"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useApi, link, stamp } from "@/lib/api-client";
import type { Page, Comment, Evidence } from "@/lib/api-types";

export function Head({
  title,
  label = "SQL SERVER / ORIGINAL RECORDS",
  children,
}: {
  title: string;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        <span className="eyebrow">{label}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Load({
  loading,
  error,
  reload,
}: {
  loading?: boolean;
  error?: string;
  reload: () => void;
}) {
  return error ? (
    <div className="callout" role="alert">
      <p>{error}</p>
      <Button type="button" variant="outline" onClick={reload}>
        Retry
      </Button>
      <p className="subtle">
        Database mode remains active.{" "}
        <Link className="text-link" href="/?mode=demo">
          Open explicit fixture demo
        </Link>
      </p>
    </div>
  ) : loading ? (
    <p role="status">Loading SQL Server records…</p>
  ) : null;
}
export function Action({
  children,
  run,
  disabled = false,
}: {
  children: ReactNode;
  run: () => Promise<unknown>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className="live-action">
      <Button
        type="button"
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await run();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : children}
      </Button>
      {error && (
        <span role="alert" className="form-error">
          {error}
        </span>
      )}
    </span>
  );
}
export function Paged<T>({
  path,
  render,
  label = "records",
}: {
  path: string;
  render: (item: T, index: number) => ReactNode;
  label?: string;
}) {
  const [position, setPosition] = useState({ path, offset: 0 });
  const offset = position.path === path ? position.offset : 0;
  const result = useApi<Page<T>>(
    `${path}${path.includes("?") ? "&" : "?"}limit=20&offset=${offset}`,
  );
  return (
    <>
      <Load {...result} />
      {result.data && (
        <>
          <div className="record-list">{result.data.items.map(render)}</div>
          {!result.data.total && <p className="empty">No matching {label}.</p>}
          <div
            className="action-row pagination"
            aria-label={`${label} pagination`}
          >
            <Button
              type="button"
              variant="outline"
              disabled={!offset}
              onClick={() =>
                setPosition({ path, offset: Math.max(0, offset - 20) })
              }
            >
              Previous
            </Button>
            <span>
              {offset + (result.data.items.length ? 1 : 0)}–
              {offset + result.data.items.length} of {result.data.total} {label}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={offset + 20 >= result.data.total}
              onClick={() => setPosition({ path, offset: offset + 20 })}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </>
  );
}
export function AccountLink({ id, name }: { id: string; name?: string }) {
  return (
    <a className="text-link" href={link("accounts", "account", id)}>
      {name ? `@${name}` : id}
    </a>
  );
}
export function CommentRow({ item }: { item: Comment }) {
  return (
    <article>
      <div className="record-meta">
        <a className="text-link" href={link("threats", "comment", item.id)}>
          {item.id}
        </a>
        <AccountLink id={item.author_id} name={item.author_handle} />
        <span>→ {item.target_id}</span>
        <time>{stamp(item.created_at)}</time>
      </div>
      <p>{item.body}</p>
      <div className="record-actions">
        {item.labels?.map((l) => (
          <span
            className="source-label"
            key={`${l.label_code}-${l.provenance_id}`}
          >
            {l.label_code} · {l.label_method}
          </span>
        ))}
        <small>
          {item.provenance_id} · {item.reviewed ? "Reviewed" : "Unreviewed"}
        </small>
        <a href={link("threats", "comment", item.id)} className="text-link">
          Open comment
        </a>
      </div>
    </article>
  );
}
export function EvidenceCard({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const result = useApi<Evidence>(open ? `evidence/${id}` : null);
  return (
    <div className="finding">
      <button
        className="text-link"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Inspect evidence {id}
      </button>
      {open && (
        <>
          <Load {...result} />
          {result.data && (
            <div>
              <p>{result.data.record_type}</p>
              <dl className="live-record">
                {Object.entries(result.data.record ?? {}).map(
                  ([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value ?? "—")}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
              {result.data.comment_id && (
                <a
                  className="text-link"
                  href={link("threats", "comment", result.data.comment_id)}
                >
                  Open comment
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

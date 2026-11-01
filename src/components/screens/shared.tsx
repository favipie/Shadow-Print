"use client";
import { ArrowUpRight, Search } from "lucide-react";
import {
  comments,
  handle,
  stamp,
  type CommentRecord,
} from "@/lib/investigation-data";
import { route } from "@/lib/demo-engine";
import { useDemo } from "@/components/demo-provider";
import { Button } from "@/components/ui/button";
export function SectionHead({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: React.ReactNode;
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
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function SearchField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="search wide-search">
      <Search size={16} />
      <input
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Empty({
  title = "No matching records",
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Search size={24} />
      <h3>{title}</h3>
      <p>{children ?? "Adjust your filters or choose another record."}</p>
    </div>
  );
}
export function AccountLink({ id }: { id: string }) {
  return (
    <a className="text-link" href={route("accounts", "account", id)}>
      @{handle(id)} <ArrowUpRight size={12} />
    </a>
  );
}
export function EvidenceRows({ ids }: { ids: string[] }) {
  return (
    <div className="record-list">
      {ids.map((id) => {
        const c = comments.find((c) => c.id === id);
        return c ? (
          <article key={id}>
            <div className="record-meta">
              <strong>{id}</strong>
              <AccountLink id={c.accountId} />
              <span>→ @{handle(c.targetId)}</span>
              <time>{stamp(c.at)}</time>
            </div>
            <p>{c.text}</p>
            <div className="record-actions">
              <span className="source-label">
                {c.source} · {c.category}
              </span>
              <a className="text-link" href={route("threats", "comment", id)}>
                Open comment <ArrowUpRight size={12} />
              </a>
            </div>
          </article>
        ) : null;
      })}
    </div>
  );
}
export function ReviewButton({ comment }: { comment: CommentRecord }) {
  const { state, update } = useDemo();
  const reviewed = state.reviewed.includes(comment.id);
  return (
    <button
      className={"review-button " + (reviewed ? "reviewed" : "")}
      aria-pressed={reviewed}
      aria-label={`${reviewed ? "Undo review" : "Mark reviewed"} ${comment.id}`}
      onClick={() =>
        update(
          `${reviewed ? "Unreviewed" : "Reviewed"} ${comment.id}`,
          (s) => ({
            ...s,
            reviewed: reviewed
              ? s.reviewed.filter((id) => id !== comment.id)
              : [...s.reviewed, comment.id],
          }),
        )
      }
    >
      {reviewed ? "Reviewed" : "Mark reviewed"}
    </button>
  );
}
export function CaseLink({
  accountId,
  commentId,
}: {
  accountId?: string;
  commentId?: string;
}) {
  return (
    <Button asChild variant="outline">
      <a
        href={route(
          "cases",
          commentId ? "comment" : "account",
          commentId ?? accountId,
        )}
      >
        Add to case
      </a>
    </Button>
  );
}

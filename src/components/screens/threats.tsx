"use client";
import { useState } from "react";
import { comments, handle, stamp } from "@/lib/investigation-data";
import { csvText, download, route } from "@/lib/demo-engine";
import { useDemo } from "@/components/demo-provider";
import { Button } from "@/components/ui/button";
import {
  AccountLink,
  CaseLink,
  Empty,
  Field,
  ReviewButton,
  SearchField,
  SectionHead,
} from "./shared";
export default function ThreatScreen({ params }: { params: URLSearchParams }) {
  const { state } = useDemo();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [review, setReview] = useState("All");
  const [source, setSource] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notice, setNotice] = useState("");
  const selected = comments.find((c) => c.id === params.get("comment"));
  const account = params.get("account");
  const invalidDates = !!from && !!to && from > to;
  const rows = comments.filter(
    (c) =>
      (!account || c.accountId === account) &&
      (category === "All" || c.category === category) &&
      (source === "All" || c.source === source) &&
      (review === "All" ||
        state.reviewed.includes(c.id) === (review === "Reviewed")) &&
      (!from || c.at.slice(0, 10) >= from) &&
      (!to || c.at.slice(0, 10) <= to) &&
      `${c.id} ${c.text} ${handle(c.accountId)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function clear() {
    setSearch("");
    setCategory("All");
    setReview("All");
    setSource("All");
    setFrom("");
    setTo("");
  }
  return (
    <div className="screen-stack">
      {selected && (
        <section className="panel selected-comment">
          <SectionHead
            label={"SELECTED COMMENT / " + selected.id}
            title={selected.category}
          >
            <a
              href={account ? route("threats", "account", account) : "#threats"}
              className="text-link"
            >
              Close selection
            </a>
          </SectionHead>
          <blockquote>{selected.text}</blockquote>
          <div className="record-meta">
            <AccountLink id={selected.accountId} />
            <span>→ @{handle(selected.targetId)}</span>
            <time>{stamp(selected.at)}</time>
            <span className="source-label">{selected.source}</span>
          </div>
          <p className="subtle">
            {selected.source === "Authored label"
              ? "Label supplied by the fictional dataset author. No NLP model has run."
              : selected.source === "Rule example"
                ? "Authored rule scenario. Use Account Investigator to run current frontend thresholds."
                : "Unlabeled benign control record."}
          </p>
          <div className="action-row">
            <Button asChild>
              <a href={route("accounts", "account", selected.accountId)}>
                Investigate account
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={route("network", "account", selected.accountId)}>
                View network
              </a>
            </Button>
            <CaseLink commentId={selected.id} />
            <ReviewButton comment={selected} />
          </div>
        </section>
      )}
      {params.get("comment") && !selected && (
        <div role="alert" className="callout">
          Comment not found. Choose a record below.
        </div>
      )}
      <section className="panel">
        <SectionHead label="SHARED SAMPLE DATASET" title="Comment review queue">
          <Button
            variant="outline"
            disabled={invalidDates}
            onClick={() => {
              download(
                "shadowprint-comments.csv",
                csvText([
                  [
                    "Comment",
                    "Account",
                    "Target",
                    "Text",
                    "Category",
                    "Provenance",
                    "UTC",
                    "Reviewed",
                  ],
                  ...rows.map((c) => [
                    c.id,
                    handle(c.accountId),
                    handle(c.targetId),
                    c.text,
                    c.category,
                    c.source,
                    c.at,
                    String(state.reviewed.includes(c.id)),
                  ]),
                ]),
              );
              setNotice(`Exported ${rows.length} sample comments.`);
            }}
          >
            Export filtered CSV
          </Button>
        </SectionHead>
        <p className="subtle">
          All {comments.length} inspectable comments, including benign controls.{" "}
          {account && (
            <>
              Scoped to @{handle(account)}.{" "}
              <a className="text-link" href="#threats">
                Clear account scope
              </a>
            </>
          )}
        </p>
        <div className="filters">
          <SearchField
            label="Search comment or account"
            value={search}
            onChange={setSearch}
          />
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>All</option>
              {Array.from(new Set(comments.map((c) => c.category))).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Review state">
            <select value={review} onChange={(e) => setReview(e.target.value)}>
              <option>All</option>
              <option>Reviewed</option>
              <option>Unreviewed</option>
            </select>
          </Field>
          <Field label="Label provenance">
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option>All</option>
              <option>Authored label</option>
              <option>Rule example</option>
              <option>Unlabeled</option>
            </select>
          </Field>
          <Field label="From date (UTC)">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To date (UTC)">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Button variant="ghost" onClick={clear}>
            Reset filters
          </Button>
        </div>
        {invalidDates ? (
          <p role="alert" className="form-error">
            From date must be on or before To date.
          </p>
        ) : (
          <>
            <p className="subtle">{rows.length} matching records</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>COMMENT / TEXT</th>
                    <th>ACCOUNT</th>
                    <th>CATEGORY / SOURCE</th>
                    <th>UTC TIME</th>
                    <th>REVIEW</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className="comment-text">
                        <a
                          className="text-link"
                          href={route("threats", "comment", c.id)}
                        >
                          {c.id} · Inspect
                        </a>
                        <p>{c.text}</p>
                      </td>
                      <td>
                        <AccountLink id={c.accountId} />
                      </td>
                      <td>
                        {c.category}
                        <small>{c.source}</small>
                      </td>
                      <td>{stamp(c.at)}</td>
                      <td>
                        <ReviewButton comment={c} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && <Empty />}
          </>
        )}
        {notice && (
          <p role="status" className="success-note">
            {notice}
          </p>
        )}
      </section>
    </div>
  );
}

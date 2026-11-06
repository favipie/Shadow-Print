"use client";
import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useApi, query, link } from "@/lib/api-client";
import type { Overview, Comment } from "@/lib/api-types";
import { Head, Field, Load, Paged, CommentRow } from "./common";
export default function OverviewScreen() {
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const filters = query({
    since: since ? `${since}T00:00:00Z` : undefined,
    until: until ? `${until}T23:59:59.999Z` : undefined,
  });
  const result = useApi<Overview>(`overview?${filters}`);
  return (
    <div className="screen-stack">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">THE SIGNAL BEHIND THE NOISE</span>
          <h2>
            Different identities.
            <br />
            <em>Connected evidence.</em>
          </h2>
          <p>
            Inspect original records, compare SQL findings, and preserve your
            investigation decisions.
          </p>
          <a className="text-link" href={link("threats")}>
            Explore the evidence →
          </a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="signal-orbit" />
        </div>
        <span className="hero-index">SHADOWPRINT / SQL SERVER</span>
      </section>
      <section className="panel">
        <Head title="Investigation overview" />
        <div className="action-row">
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
              min={since}
              onChange={(e) => setUntil(e.target.value)}
            />
          </Field>
        </div>
        <Load {...result} />
      </section>
      {result.data && (
        <>
          <section className="metrics" aria-label="Overview metrics">
            {[
              ["Comment records", result.data.counts.comments],
              ["Labeled comments", result.data.counts.labeled_comments],
              ["Reviewed comments", result.data.counts.reviewed_comments],
              ["Open investigations", result.data.counts.open_cases],
            ].map(([name, count]) => (
              <article className="metric" key={name}>
                <span>{name}</span>
                <strong>{count}</strong>
                <small>SQL Server records</small>
              </article>
            ))}
          </section>
          <section className="panel">
            <Head title="Comment activity" label="ORIGINAL RECORDS / UTC" />
            <div
              className="chart"
              role="img"
              aria-label="Comment activity from SQL Server"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.data.timeline}>
                  <CartesianGrid stroke="#27303d" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#151c27",
                      borderColor: "#27303d",
                    }}
                  />
                  <Area
                    dataKey="labeled_comments"
                    name="Labeled comments"
                    stroke="#2dd4bf"
                    fill="#2dd4bf33"
                  />
                  <Area
                    dataKey="comments"
                    name="All comments"
                    stroke="#c1ec80"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="subtle">{result.data.scope}</p>
          </section>
        </>
      )}
      <section className="panel">
        <Head title="Evidence stream" />
        <Paged<Comment>
          path={`comments?${filters}`}
          label="comments"
          render={(item) => <CommentRow key={item.id} item={item} />}
        />
      </section>
    </div>
  );
}

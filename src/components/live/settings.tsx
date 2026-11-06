"use client";
import Link from "next/link";
import { useApi, writeApi, stamp } from "@/lib/api-client";
import type { Rule } from "@/lib/api-types";
import { Head, Load, Paged, Action } from "./common";
type Audit = {
  id: number;
  action: string;
  occurred_at: string;
  investigator_id: string;
  investigation_id?: string;
  new_value: unknown;
};
export default function SettingsScreen() {
  const result = useApi<Record<string, string>>("settings");
  return (
    <div className="screen-stack">
      <section className="panel">
        <Head title="Connection & access" />
        <Load {...result} />
        {result.data && (
          <dl className="live-record">
            {Object.entries(result.data).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="callout">
          Next.js → FastAPI → Microsoft SQL Server. The service key stays on the
          Next.js server. Access is restricted to this local workspace;
          multi-user authentication is not implemented.
        </p>
        <Link href="/?mode=demo" className="text-link">
          Open explicitly labeled fixture demo
        </Link>
      </section>
      <section className="panel">
        <Head
          title="Detection rules"
          label="PERSISTED SQL V1 / READ-ONLY THRESHOLDS"
        />
        <Paged<Rule>
          path="rules"
          label="rules"
          render={(r) => (
            <article key={r.code + r.version}>
              <strong>
                {r.code} · version {r.version} · weight {r.weight}
              </strong>
              <p>{r.description}</p>
              <small>
                Minimum {r.min_count} · window {r.window_seconds} seconds
              </small>
            </article>
          )}
        />
        <Action
          run={() =>
            writeApi("detection-runs", { id: "ui-" + crypto.randomUUID() })
          }
        >
          Create a new detection run
        </Action>
        <p className="subtle">
          Creates a new persisted run; existing findings remain unchanged.
        </p>
      </section>
      <section className="panel">
        <Head title="Data provenance" />
        <Paged<{
          id: string;
          name: string;
          kind: string;
          description: string;
          license_text: string;
        }>
          path="provenance"
          label="sources"
          render={(p) => (
            <article key={p.id}>
              <strong>
                {p.name} · {p.kind}
              </strong>
              <p>{p.description}</p>
              <small>{p.license_text}</small>
            </article>
          )}
        />
      </section>
      <section className="panel">
        <Head title="Audit history" />
        <Paged<Audit>
          path="audit"
          label="audit events"
          render={(a) => (
            <article key={a.id}>
              <strong>
                {a.action} · {a.investigation_id}
              </strong>
              <small>
                {stamp(a.occurred_at)} · {a.investigator_id}
              </small>
              <details>
                <summary>Recorded change</summary>
                <pre className="live-json">
                  {JSON.stringify(a.new_value, null, 2)}
                </pre>
              </details>
            </article>
          )}
        />
      </section>
    </div>
  );
}

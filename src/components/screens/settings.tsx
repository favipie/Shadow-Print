"use client";
import { useState } from "react";
import {
  profiles,
  comments,
  devices,
  defaultThresholds,
  stamp,
  limitation,
} from "@/lib/investigation-data";
import { validThresholds } from "@/lib/demo-engine";
import { useDemo } from "@/components/demo-provider";
import { Button } from "@/components/ui/button";
import { Field, SectionHead } from "./shared";
export default function SettingsScreen() {
  const { state, update, storageError } = useDemo();
  const [draft, setDraft] = useState(state.thresholds);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fields = [
    {
      key: "repetition" as const,
      label: "Identical comments required",
      min: 2,
      max: 20,
    },
    {
      key: "windowMinutes" as const,
      label: "Repetition window (minutes)",
      min: 1,
      max: 120,
    },
    {
      key: "coordinationAccounts" as const,
      label: "Distinct coordinated accounts",
      min: 2,
      max: 9,
    },
    {
      key: "coordinationSeconds" as const,
      label: "Coordination window (seconds)",
      min: 10,
      max: 600,
    },
  ];
  return (
    <div className="screen-stack">
      <div className="settings-grid">
        <section className="panel">
          <SectionHead label="RULE VERSION V1" title="Detection thresholds" />
          <p className="subtle">
            Applied to frontend demo analysis only. Authored labels and
            reference graph connections remain unchanged.
          </p>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validThresholds(draft)) {
                setError("Enter whole numbers within the displayed limits.");
                return;
              }
              update("Updated detection thresholds", (s) => ({
                ...s,
                thresholds: { ...draft },
              }));
              setError("");
              setNotice(
                "Thresholds saved. Re-run account analysis to see updated findings.",
              );
            }}
          >
            {fields.map((f) => (
              <Field key={f.key} label={`${f.label} (${f.min}–${f.max})`}>
                <input
                  required
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={1}
                  value={Number.isNaN(draft[f.key]) ? "" : draft[f.key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [f.key]:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </Field>
            ))}
            <div className="action-row">
              <Button type="submit">Save thresholds</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft({ ...defaultThresholds });
                  setNotice("Defaults loaded into form. Save to apply.");
                }}
              >
                Restore form defaults
              </Button>
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="success-note">
                {notice}
              </p>
            )}
          </form>
        </section>
        <section className="panel">
          <SectionHead
            label="TRANSPARENT PROVENANCE"
            title="Dataset & configuration"
          />
          <dl className="definition-list">
            <div>
              <dt>Source</dt>
              <dd>SHADOWPRINT authored synthetic fixture v2</dd>
            </div>
            <div>
              <dt>Records</dt>
              <dd>
                {profiles.length} accounts · {comments.length} comments ·{" "}
                {devices.length} pseudonymous devices
              </dd>
            </div>
            <div>
              <dt>Public dataset imports</dt>
              <dd>
                None. Jigsaw, Civil Comments and HateXplain are not imported.
              </dd>
            </div>
            <div>
              <dt>License / ownership</dt>
              <dd>
                Project-authored demonstration text. No third-party dataset
                license applies. Reference artwork is user supplied; public
                reuse rights are unverified.
              </dd>
            </div>
            <div>
              <dt>Database connection</dt>
              <dd>
                <span className="status-label">Not connected</span> · planned
                after frontend review
              </dd>
            </div>
            <div>
              <dt>Authentication</dt>
              <dd>Demo reviewer only. No real authentication.</dd>
            </div>
            <div>
              <dt>Local persistence</dt>
              <dd>
                {storageError ||
                  "Cases, notes, review marks and thresholds use versioned browser storage. Do not enter sensitive information."}
              </dd>
            </div>
            <div>
              <dt>Time display</dt>
              <dd>UTC for all fictional events and audit records.</dd>
            </div>
            <div>
              <dt>Scoring</dt>
              <dd>
                Repetition +25; authored threat label +25; repeated targeting
                +20; coordination +30. Device-only links +0. High ≥45; Medium
                ≥20; Low &lt;20.
              </dd>
            </div>
          </dl>
          <div className="callout">{limitation}</div>
        </section>
      </div>
      <section className="panel">
        <SectionHead
          label="LOCAL AUDIT LOG / LATEST 200 ACTIONS"
          title="Workspace changes"
        />
        {state.audit.length ? (
          <div className="audit-list">
            {state.audit.map((a) => (
              <div key={a.id}>
                <strong>{a.action}</strong>
                <time>{stamp(a.at)}</time>
              </div>
            ))}
          </div>
        ) : (
          <p className="subtle">
            No edits yet. Case, review and threshold changes will appear here.
          </p>
        )}
      </section>
    </div>
  );
}

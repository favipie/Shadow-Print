"use client";
import { useDeferredValue, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi, writeApi, query, link, stamp } from "@/lib/api-client";
import {
  caseStatuses,
  type Case,
  type CaseStatus,
  type Account,
  type Comment,
  type Note,
} from "@/lib/api-types";
import {
  Head,
  Field,
  Load,
  Paged,
  AccountLink,
  EvidenceCard,
  Action,
} from "./common";
type Draft = Pick<
  Case,
  | "title"
  | "description"
  | "status"
  | "decision"
  | "account_ids"
  | "evidence_ids"
  | "finding_ids"
>;
function Editor({
  record,
  seed,
  close,
}: {
  record?: Case;
  seed: Draft;
  close: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(seed);
  const [evidenceText, setEvidenceText] = useState(
    seed.evidence_ids.join(", "),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = record
        ? { ...draft, expected_updated_at: record.updated_at }
        : draft;
      const saved = await writeApi<Case>(
        record ? `cases/${record.id}` : "cases",
        body,
        record ? "PUT" : "POST",
      );
      close();
      window.location.hash = link("cases", "case", saved.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal case-modal">
          <Dialog.Title>
            {record ? "Edit investigation" : "New investigation"}
          </Dialog.Title>
          <Dialog.Description>
            Save evidence associations and decisions in SQL Server.
          </Dialog.Description>
          <form onSubmit={save} className="form-stack">
            <Field label="Case title">
              <input
                required
                maxLength={255}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                maxLength={10000}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </Field>
            <Field label="Case status">
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft({ ...draft, status: e.target.value as CaseStatus })
                }
              >
                {caseStatuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Decision / resolution">
              <textarea
                required={
                  draft.status === "Closed" || draft.status === "Resolved"
                }
                maxLength={10000}
                value={draft.decision}
                onChange={(e) =>
                  setDraft({ ...draft, decision: e.target.value })
                }
              />
            </Field>
            <fieldset className="checklist">
              <legend>Associated accounts</legend>
              <Paged<Account>
                path="accounts"
                label="accounts"
                render={(a) => (
                  <label key={a.id}>
                    <input
                      type="checkbox"
                      checked={draft.account_ids.includes(a.id)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          account_ids: e.target.checked
                            ? [...draft.account_ids, a.id]
                            : draft.account_ids.filter((id) => id !== a.id),
                        })
                      }
                    />
                    @{a.handle} · {a.id}
                  </label>
                )}
              />
            </fieldset>
            <Field label="Evidence IDs (comma separated)">
              <input
                value={evidenceText}
                onChange={(e) => (
                  setEvidenceText(e.target.value),
                  setDraft({
                    ...draft,
                    evidence_ids: e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                )}
              />
            </Field>
            <p className="subtle">
              Use “Add to case” on an original comment to prefill its evidence
              IDs. Existing login and finding associations are retained.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="action-row">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save case"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </Button>
            </div>
          </form>
          <Dialog.Close
            className="icon-button close"
            aria-label="Close case editor"
            disabled={busy}
          >
            <X size={18} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function CaseDetail({
  id,
  edit,
}: {
  id: string;
  edit: (record: Case) => void;
}) {
  const result = useApi<Case>(`cases/${id}`);
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <div className="screen-stack">
      <Load {...result} />
      {result.data && (
        <>
          <section className="panel">
            <Head
              title={result.data.title}
              label={`${id} / ${result.data.status}`}
            >
              <Button variant="outline" onClick={() => edit(result.data!)}>
                Edit case
              </Button>
            </Head>
            <p>{result.data.description}</p>
            <small>Updated {stamp(result.data.updated_at)}</small>
            <div className="action-row">
              {result.data.account_ids.map((id) => (
                <AccountLink key={id} id={id} />
              ))}
            </div>
            <div className="callout">
              <strong>Decision</strong>
              <p>{result.data.decision || "No decision recorded."}</p>
            </div>
            <a className="text-link" href={link("reports", "case", id)}>
              Open investigation report
            </a>
          </section>
          <section className="panel">
            <Head title="Evidence register" />
            {result.data.evidence_ids.length ? (
              result.data.evidence_ids.map((e) => (
                <EvidenceCard key={e} id={e} />
              ))
            ) : (
              <p>No evidence attached.</p>
            )}
          </section>
          <section className="panel">
            <Head title="Investigator notes" />
            <Paged<Note>
              path={`cases/${id}/notes`}
              label="notes"
              render={(n) => (
                <article className="note" key={n.id}>
                  <p>{n.body}</p>
                  <small>
                    {stamp(n.created_at)} · {n.investigator_id}
                  </small>
                </article>
              )}
            />
            <Field label="New investigator note">
              <textarea
                value={note}
                maxLength={10000}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <Action
              disabled={!note.trim()}
              run={async () => {
                await writeApi(`cases/${id}/notes`, { body: note });
                setNote("");
                setNotice("Investigator note saved in SQL Server.");
              }}
            >
              Add note
            </Action>
            {notice && <p role="status">{notice}</p>}
          </section>
        </>
      )}
    </div>
  );
}
export default function CasesScreen({ params }: { params: URLSearchParams }) {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search);
  const [status, setStatus] = useState("");
  const [editor, setEditor] = useState<{ record?: Case; seed: Draft } | null>(
    null,
  );
  const commentId = params.get("comment");
  const incoming = useApi<Comment>(commentId ? `comments/${commentId}` : null);
  const accountId = params.get("account");
  const id = params.get("case");
  const draft: Draft = {
    title: "",
    description: "",
    status: "Open",
    decision: "",
    account_ids: incoming.data
      ? [incoming.data.author_id]
      : accountId
        ? [accountId]
        : [],
    evidence_ids: incoming.data?.evidence?.map((e) => e.id) ?? [],
    finding_ids: [],
  };
  return (
    <div className="screen-stack">
      {commentId && (
        <section className="panel">
          <Load {...incoming} />
          {incoming.data && (
            <div className="action-row">
              <span>{commentId} is ready to associate with a case.</span>
              <Button onClick={() => setEditor({ seed: draft })}>
                Create case with evidence
              </Button>
              <AttachExisting comment={incoming.data} />
            </div>
          )}
        </section>
      )}
      <div className="screen-grid">
        <aside className="panel directory">
          <Head title="Investigations" label="PERSISTENT CASEBOOK">
            <Button
              disabled={incoming.loading}
              onClick={() => setEditor({ seed: draft })}
            >
              New
            </Button>
          </Head>
          <Field label="Search case title or ID">
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
          <Field label="Status filter">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {caseStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Paged<Case>
            path={`cases?${query({ q: deferred, status })}`}
            label="cases"
            render={(c) => (
              <a
                className={`directory-item ${id === c.id ? "selected" : ""}`}
                href={link("cases", "case", c.id)}
                key={c.id}
              >
                <span>
                  <strong>{c.title}</strong>
                  <small>
                    {c.id} · {c.status}
                  </small>
                </span>
              </a>
            )}
          />
        </aside>
        {id ? (
          <CaseDetail
            key={id}
            id={id}
            edit={(record) =>
              setEditor({
                record,
                seed: {
                  title: record.title,
                  description: record.description,
                  status: record.status,
                  decision: record.decision,
                  account_ids: record.account_ids,
                  evidence_ids: record.evidence_ids,
                  finding_ids: record.finding_ids,
                },
              })
            }
          />
        ) : (
          <section className="panel">
            <p>Select an investigation or create a new case.</p>
          </section>
        )}
      </div>
      {editor && (
        <Editor
          record={editor.record}
          seed={editor.seed}
          close={() => setEditor(null)}
        />
      )}
    </div>
  );
}
function AttachExisting({ comment }: { comment: Comment }) {
  const [caseId, setCaseId] = useState("");
  const existing = useApi<Case>(caseId ? `cases/${caseId}` : null);
  return (
    <div className="form-stack">
      <Field label="Existing case ID">
        <input
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          placeholder="Paste a case ID to attach evidence"
        />
      </Field>
      <Load {...existing} />
      {existing.data && (
        <Action
          run={async () => {
            const c = existing.data!;
            await writeApi(
              `cases/${c.id}`,
              {
                title: c.title,
                description: c.description,
                status: c.status,
                decision: c.decision,
                expected_updated_at: c.updated_at,
                account_ids: [
                  ...new Set([...c.account_ids, comment.author_id]),
                ],
                evidence_ids: [
                  ...new Set([
                    ...c.evidence_ids,
                    ...(comment.evidence?.map((e) => e.id) ?? []),
                  ]),
                ],
                finding_ids: c.finding_ids,
              },
              "PUT",
            );
            window.location.hash = link("cases", "case", c.id);
          }}
        >
          Attach to {existing.data.title}
        </Action>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { useDataset, useLive } from "@/components/data-provider";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus } from "lucide-react";
import { statuses, stamp, type CaseRecord } from "@/lib/investigation-data";
import { caseValidation, route } from "@/lib/demo-engine";
import { useDemo } from "@/components/demo-provider";
import { Button } from "@/components/ui/button";
import {
  AccountLink,
  Empty,
  EvidenceRows,
  Field,
  SearchField,
  SectionHead,
} from "./shared";
function CaseEditor({
  record,
  onSave,
  onClose,
}: {
  record: CaseRecord;
  onSave: (c: CaseRecord) => void | Promise<void>;
  onClose: () => void;
}) {
  const { profiles, comments, handle } = useDataset();
  const live = useLive();
  const [draft, setDraft] = useState(record);
  const [error, setError] = useState("");
  function toggle(key: "accountIds" | "commentIds", id: string) {
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(id)
        ? d[key].filter((v) => v !== id)
        : [...d[key], id],
    }));
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal case-modal">
          <Dialog.Title>
            {record.id ? "Edit investigation" : "New investigation"}
          </Dialog.Title>
          <Dialog.Description>
            {live
              ? "Choose evidence and record decisions. Changes persist in SQL Server. Details and status save as separate audited operations."
              : "Local demo case. Choose evidence and record decisions; changes stay in this browser."}
          </Dialog.Description>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const message = caseValidation(draft);
              setError(message);
              if (!message)
                try {
                  await onSave({
                    ...draft,
                    title: draft.title.trim(),
                    description: draft.description.trim(),
                    decision: draft.decision.trim(),
                  });
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Case could not be saved.",
                  );
                }
            }}
          >
            <Field label="Case title">
              <input
                required
                maxLength={100}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                required
                maxLength={1500}
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
                  setDraft({
                    ...draft,
                    status: e.target.value as CaseRecord["status"],
                  })
                }
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Decision / resolution">
              <textarea
                maxLength={1500}
                value={draft.decision}
                onChange={(e) =>
                  setDraft({ ...draft, decision: e.target.value })
                }
                placeholder="Required when resolving or closing a case"
              />
            </Field>
            <fieldset className="checklist">
              <legend>Associated accounts</legend>
              {profiles.map((p) => (
                <label key={p.id}>
                  <input
                    type="checkbox"
                    checked={draft.accountIds.includes(p.id)}
                    onChange={() => toggle("accountIds", p.id)}
                  />
                  @{p.handle}
                </label>
              ))}
            </fieldset>
            <fieldset className="checklist">
              <legend>Evidence comments</legend>
              {comments.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={draft.commentIds.includes(c.id)}
                    onChange={() => toggle("commentIds", c.id)}
                  />
                  {c.id} · @{handle(c.accountId)} · {c.category}
                </label>
              ))}
            </fieldset>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="action-row">
              <Button type="submit" disabled={live?.busy}>
                Save case
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
          <Dialog.Close
            className="icon-button close"
            aria-label="Close case editor"
          >
            <X size={18} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export default function CasesScreen({ params }: { params: URLSearchParams }) {
  const { profiles, comments, clusters } = useDataset();
  const live = useLive();
  const { state, update } = useDemo();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [editor, setEditor] = useState<CaseRecord | null>(null);
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const caseId = params.get("case") ?? state.cases[0]?.id;
  const selected = state.cases.find((c) => c.id === caseId);
  const cluster = clusters.find((c) => c.id === params.get("cluster"));
  const comment = comments.find((c) => c.id === params.get("comment"));
  const account = profiles.find((p) => p.id === params.get("account"));
  const inboundAccounts =
    cluster?.members ??
    (comment ? [comment.accountId] : account ? [account.id] : []);
  const inboundComments = cluster?.commentIds ?? (comment ? [comment.id] : []);
  const hasInbound = inboundAccounts.length + inboundComments.length > 0;
  const rows = state.cases.filter(
    (c) =>
      (status === "All" || c.status === status) &&
      `${c.id} ${c.title}`.toLowerCase().includes(search.toLowerCase()),
  );
  function create() {
    setEditor({
      id: "",
      title: cluster?.name ?? "",
      description: cluster?.description ?? "",
      status: "Open",
      accountIds: inboundAccounts,
      commentIds: inboundComments,
      notes: [],
      decision: "",
      updatedAt: new Date().toISOString(),
    });
  }
  async function save(draft: CaseRecord) {
    if (live) {
      const saved = await live.saveCase(draft);
      setEditor(null);
      window.location.hash = route("cases", "case", saved.id);
      setNotice("Case saved to SQL Server.");
      return;
    }
    const id =
      draft.id || "SP-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const record = { ...draft, id, updatedAt: new Date().toISOString() };
    update(`${draft.id ? "Updated" : "Created"} case ${id}`, (s) => ({
      ...s,
      cases: draft.id
        ? s.cases.map((c) => (c.id === id ? record : c))
        : [record, ...s.cases],
    }));
    setEditor(null);
    window.location.hash = route("cases", "case", id);
    setNotice("Case saved locally.");
  }
  async function attach() {
    if (!selected) return;
    if (live) {
      try {
        await live.saveCase({
          ...selected,
          accountIds: [
            ...new Set([...selected.accountIds, ...inboundAccounts]),
          ],
          commentIds: [
            ...new Set([...selected.commentIds, ...inboundComments]),
          ],
        });
        setNotice("Evidence saved to " + selected.id + ".");
      } catch {
        setNotice("");
      }
      return;
    }
    update(`Attached evidence to ${selected.id}`, (s) => ({
      ...s,
      cases: s.cases.map((c) =>
        c.id === selected.id
          ? {
              ...c,
              accountIds: [...new Set([...c.accountIds, ...inboundAccounts])],
              commentIds: [...new Set([...c.commentIds, ...inboundComments])],
              updatedAt: new Date().toISOString(),
            }
          : c,
      ),
    }));
    setNotice("Evidence attached to " + selected.id + ".");
  }
  return (
    <div className="screen-stack">
      {hasInbound && (
        <div className="callout incoming-evidence">
          <div>
            <strong>Continue investigation</strong>
            <p>
              {inboundAccounts.length} account(s), {inboundComments.length}{" "}
              comment(s) ready to associate.
            </p>
          </div>
          <Button onClick={create}>Create case with evidence</Button>
          <Button variant="outline" disabled={!selected} onClick={attach}>
            Attach to {selected?.id ?? "selected case"}
          </Button>
        </div>
      )}
      <div className="screen-grid">
        <aside className="panel directory">
          <SectionHead
            label={live ? "SQL CASEBOOK" : "LOCAL CASEBOOK"}
            title="Investigations"
          >
            <Button onClick={create}>
              <Plus size={14} />
              New
            </Button>
          </SectionHead>
          <SearchField
            value={search}
            onChange={setSearch}
            label="Search case title or ID"
          />
          <Field label="Status filter">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>All</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          {rows.length ? (
            rows.map((c) => (
              <a
                key={c.id}
                className={
                  "directory-item " + (selected?.id === c.id ? "selected" : "")
                }
                href={
                  route("cases", "case", c.id) +
                  (hasInbound
                    ? "&" +
                      new URLSearchParams(
                        cluster
                          ? { cluster: cluster.id }
                          : comment
                            ? { comment: comment.id }
                            : { account: account!.id },
                      ).toString()
                    : "")
                }
                onClick={() => setNote("")}
              >
                <span>
                  <strong>{c.title}</strong>
                  <small>
                    {c.id} · {c.status}
                  </small>
                </span>
              </a>
            ))
          ) : (
            <Empty />
          )}
        </aside>
        <div className="screen-stack">
          {selected ? (
            <>
              <section className="panel">
                <SectionHead
                  label={selected.id + " / " + selected.status.toUpperCase()}
                  title={selected.title}
                >
                  <Button variant="outline" onClick={() => setEditor(selected)}>
                    Edit case
                  </Button>
                </SectionHead>
                <p className="case-description">{selected.description}</p>
                <small>Updated {stamp(selected.updatedAt)}</small>
                <div className="action-row">
                  {selected.accountIds.map((id) => (
                    <AccountLink key={id} id={id} />
                  ))}
                </div>
                <div className="callout">
                  <strong>Decision</strong>
                  <p>
                    {selected.decision ||
                      "No decision recorded. Evidence review is ongoing."}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <a href={route("reports", "case", selected.id)}>
                    Open investigation report
                  </a>
                </Button>
              </section>
              <section className="panel">
                <SectionHead
                  label={`${selected.commentIds.length} ASSOCIATED RECORDS`}
                  title="Evidence register"
                />
                {selected.commentIds.length ? (
                  <EvidenceRows ids={selected.commentIds} />
                ) : (
                  <Empty title="No comments attached">
                    Edit the case or add a comment from Threat Monitor.
                  </Empty>
                )}
              </section>
              <section className="panel">
                <SectionHead label="HUMAN REVIEW" title="Investigator notes" />
                {selected.notes.map((n, i) => (
                  <div className="note" key={i}>
                    <p>{n.text}</p>
                    <small>{stamp(n.at)}</small>
                  </div>
                ))}
                {!selected.notes.length && (
                  <p className="subtle">No notes yet.</p>
                )}
                <form
                  className="form-stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!note.trim()) return;
                    if (live) {
                      try {
                        await live.addNote(selected.id, note.trim());
                        setNote("");
                        setNotice("Investigator note saved to SQL Server.");
                      } catch {
                        setNotice("");
                      }
                      return;
                    }
                    const at = new Date().toISOString();
                    update(`Added note to ${selected.id}`, (s) => ({
                      ...s,
                      cases: s.cases.map((c) =>
                        c.id === selected.id
                          ? {
                              ...c,
                              notes: [...c.notes, { text: note.trim(), at }],
                              updatedAt: at,
                            }
                          : c,
                      ),
                    }));
                    setNote("");
                    setNotice("Investigator note saved.");
                  }}
                >
                  <Field label="New investigator note">
                    <textarea
                      required
                      maxLength={2000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Record context, uncertainties, and next steps…"
                    />
                  </Field>
                  <Button disabled={!note.trim() || live?.busy} type="submit">
                    Add note
                  </Button>
                </form>
              </section>
            </>
          ) : (
            <section className="panel">
              <Empty title="Case not found">
                Select an existing case or create a new one.
              </Empty>
            </section>
          )}
        </div>
      </div>
      {notice && (
        <p role="status" className="success-note">
          {notice}
        </p>
      )}
      {editor && (
        <CaseEditor
          record={editor}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

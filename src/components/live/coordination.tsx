"use client";
import { useState } from "react";
import type { Comment } from "@/lib/api-types";
import { Head, Paged, CommentRow } from "./common";
type Window = { anchor_id: string; target_id: string; account_count: number };
function WindowRow({ item }: { item: Window }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="finding">
      <button aria-expanded={open} onClick={() => setOpen(!open)}>
        <strong>{item.anchor_id}</strong> · {item.account_count} accounts →{" "}
        {item.target_id}
      </button>
      <p>
        Identical normalized text within the persisted SQL rule window. Review
        original context before deciding.
      </p>
      {open && (
        <Paged<Comment>
          path={`coordination/${item.anchor_id}/comments`}
          label="supporting comments"
          render={(c) => <CommentRow key={c.id} item={c} />}
        />
      )}
    </article>
  );
}
export default function CoordinationScreen() {
  return (
    <section className="panel">
      <Head
        title="Coordination analysis"
        label="CURRENT SQL WINDOWS / ORIGINAL EVIDENCE"
      />
      <p className="callout">
        A shared-device observation alone never qualifies as coordinated
        posting. The library controls remain unflagged.
      </p>
      <Paged<Window>
        path="coordination"
        label="coordination windows"
        render={(item) => <WindowRow key={item.anchor_id} item={item} />}
      />
    </section>
  );
}

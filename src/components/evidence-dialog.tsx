import * as Dialog from "@radix-ui/react-dialog";
import { X, FileSearch } from "lucide-react";
export type Detail = {
  title: string;
  subtitle: string;
  records: string[];
};
export function EvidenceDialog({
  detail,
  onClose,
}: {
  detail: Detail | null;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open={!!detail}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <div className="modal-symbol">
            <FileSearch size={24} />
          </div>
          <Dialog.Title>{detail?.title}</Dialog.Title>
          <Dialog.Description>{detail?.subtitle}</Dialog.Description>
          <div className="evidence-list">
            {detail?.records.map((record, i) => (
              <div key={record}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{record}</p>
              </div>
            ))}
          </div>
          <p className="disclaimer">
            Synthetic preview evidence. Findings support human review and do not
            establish identity or intent.
          </p>
          <Dialog.Close
            className="icon-button close"
            aria-label="Close evidence"
          >
            <X size={20} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

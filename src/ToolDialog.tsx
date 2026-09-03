import { useEffect, useId, useRef, type ReactNode } from "react";
import { useUnsavedChanges } from "./lib/useUnsavedChanges";
export default function ToolDialog({
  title,
  onClose,
  children,
  busy = false,
  dirty = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  dirty?: boolean;
}) {
  const canClose = useUnsavedChanges(dirty);
  const requestClose = () => {
    if (!busy && canClose()) onClose();
  };
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="management-dialog"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="icon-btn"
          disabled={busy}
          aria-label={`Fechar ${title}`}
          onClick={requestClose}
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}

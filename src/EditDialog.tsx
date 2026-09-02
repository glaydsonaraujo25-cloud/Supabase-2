import { useEffect, useRef, useState, type FormEvent } from "react";
type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
};
export default function EditDialog({
  title,
  values,
  fields,
  onSave,
  onClose,
}: {
  title: string;
  values: Record<string, string>;
  fields: Field[];
  onSave: (v: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(values),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (fields.some((f) => f.required && !form[f.name]?.trim())) {
      setError("Preencha os campos obrigatórios.");
      return;
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError("O término deve ser igual ou posterior ao início.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(form);
    } catch (e) {
      setError((e as Error).message || "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="edit-dialog"
      aria-labelledby="edit-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <h2 id="edit-title">{title}</h2>
        {fields.map((f) => (
          <label key={f.name}>
            {f.label}
            <input
              autoFocus={f === fields[0]}
              type={f.type || "text"}
              min={f.min}
              max={f.max}
              required={f.required}
              value={form[f.name]}
              onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
            />
          </label>
        ))}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

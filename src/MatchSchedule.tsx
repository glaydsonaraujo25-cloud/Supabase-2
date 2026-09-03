import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";
import { matchStatus } from "./lib/competition";
export function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
type Match = {
  id: string;
  scheduled_at: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  bracket_stage?: string | null;
};
export default function MatchSchedule({
  match,
  title,
  onClose,
  onSaved,
}: {
  match: Match;
  title: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(localDateTime(match.scheduled_at)),
    [status, setStatus] = useState(match.status),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (
      status === "finalizado" &&
      (match.home_score === null || match.away_score === null)
    ) {
      setError("Lance o placar da partida antes de finalizá-la.");
      return;
    }
    if (date && Number.isNaN(new Date(date).getTime())) {
      setError("Informe uma data válida.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error: failure } = await supabase
        .from("matches")
        .update({
          scheduled_at: date ? new Date(date).toISOString() : null,
          status,
        })
        .eq("id", match.id)
        .eq("status", match.status)
        .select("id")
        .single();
      if (failure) throw failure;
      if (!data)
        throw new Error(
          "A partida mudou ou você não tem permissão. Atualize a página.",
        );
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message || "Não foi possível salvar a partida.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="edit-dialog"
      aria-labelledby="match-edit-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form onSubmit={save}>
        <h2 id="match-edit-title">Gerenciar partida</h2>
        <p>{title}</p>
        <label>
          Data e horário
          <input
            autoFocus
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <small>
          Horário local do seu dispositivo. Deixe vazio para definir depois.
        </small>
        <label>
          Status da partida
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["agendado", "em_andamento", "finalizado", "cancelado"].map(
              (s) => (
                <option
                  key={s}
                  value={s}
                  disabled={s === "finalizado" && match.status !== "finalizado"}
                >
                  {matchStatus(s)}
                </option>
              ),
            )}
          </select>
        </label>
        {match.status === "finalizado" && status !== "finalizado" && (
          <p className="notice">
            O placar será preservado, mas esta partida deixará de contar na
            classificação até ser finalizada novamente.
          </p>
        )}
        {error && (
          <p role="alert" className="notice">
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
            Voltar
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar partida"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

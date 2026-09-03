import { scheduleConflicts, type ScheduledGame } from "./lib/scheduling";
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
type Match = ScheduledGame & {
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
  games = [],
  teams = [],
  scheduleOnly = false,
}: {
  games?: ScheduledGame[];
  teams?: { id: string; name: string }[];
  scheduleOnly?: boolean;
  match: Match;
  title: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [venue, setVenue] = useState(match.venue || ""),
    [duration, setDuration] = useState(
      match.duration_minutes?.toString() || "",
    );
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(localDateTime(match.scheduled_at)),
    [status, setStatus] = useState(match.status),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const conflicts = scheduleConflicts(
    {
      ...match,
      venue,
      duration_minutes: duration ? Number(duration) : null,
      status,
      scheduled_at:
        date && Number.isFinite(Date.parse(date))
          ? new Date(date).toISOString()
          : null,
    },
    games,
  );
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
          ...(scheduleOnly ? {} : { status }),
          venue: venue.trim() || null,
          duration_minutes: duration ? Number(duration) : null,
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
          Local da partida
          <input
            maxLength={200}
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Ex.: Quadra do Centro"
            list="match-venues"
          />
        </label>
        <datalist id="match-venues">
          {[...new Set(games.map((g) => g.venue).filter(Boolean))].map((v) => (
            <option key={v!} value={v!} />
          ))}
        </datalist>
        <label>
          Duração prevista (minutos)
          <input
            type="number"
            min={1}
            max={1440}
            step={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Opcional"
          />
        </label>
        <small>
          Avisos consideram os jogos carregados deste campeonato. Sem duração,
          só é possível comparar o início com horários conhecidos. Use o mesmo
          nome para o mesmo local.
        </small>
        {conflicts.length > 0 && (
          <div className="notice" role="status">
            <strong>Possível conflito de horário</strong>
            <ul>
              {conflicts.map(({ game, sharedTeam, sharedVenue }) => (
                <li key={game.id}>
                  {teams.find((t) => t.id === game.home_team_id)?.name ||
                    "Time"}{" "}
                  ×{" "}
                  {teams.find((t) => t.id === game.away_team_id)?.name ||
                    "Time"}{" "}
                  · {new Date(game.scheduled_at!).toLocaleString("pt-BR")} ·{" "}
                  {sharedTeam ? "mesmo time" : ""}
                  {sharedTeam && sharedVenue ? " e " : ""}
                  {sharedVenue ? "mesmo local" : ""}
                </li>
              ))}
            </ul>
            <p>Revise os horários antes de salvar.</p>
          </div>
        )}
        {!scheduleOnly && (
          <label>
            Status da partida
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {["agendado", "em_andamento", "finalizado", "cancelado"].map(
                (s) => (
                  <option
                    key={s}
                    value={s}
                    disabled={
                      s === "finalizado" && match.status !== "finalizado"
                    }
                  >
                    {matchStatus(s)}
                  </option>
                ),
              )}
            </select>
          </label>
        )}
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

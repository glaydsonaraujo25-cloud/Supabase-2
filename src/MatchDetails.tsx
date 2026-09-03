import { useEffect, useRef } from "react";
import { matchStatus } from "./lib/competition";
import "./match-details.css";

export type DetailMatch = {
  venue?: string | null;
  duration_minutes?: number | null;
  id: string;
  championship_id: string;
  home_team_id: string;
  away_team_id: string;
  round: number;
  status: string;
  scheduled_at?: string | null;
  home_score: number | null;
  away_score: number | null;
  bracket_stage?: string | null;
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
};
export type DetailEvent = {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string | null;
  event_type: string;
  minute: number | null;
};
export type DetailPlayer = {
  id: string;
  team_id: string;
  name: string;
  shirt_number: number | null;
  position?: string | null;
};
export type DetailTeam = {
  id: string;
  name: string;
  group_name?: string | null;
};
const labels: Record<string, string> = {
  goal: "Gol",
  assist: "Assistência",
  yellow_card: "Cartão amarelo",
  red_card: "Cartão vermelho",
};

export default function MatchDetails({
  match,
  teams,
  players,
  events,
  onClose,
  loading = false,
  error = "",
  retry,
}: {
  match: DetailMatch;
  teams: DetailTeam[];
  players: DetailPlayer[];
  events: DetailEvent[];
  onClose: () => void;
  loading?: boolean;
  error?: string;
  retry?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const home = teams.find((t) => t.id === match.home_team_id),
    away = teams.find((t) => t.id === match.away_team_id);
  const records = events
    .filter(
      (e) =>
        e.match_id === match.id &&
        (e.team_id === match.home_team_id || e.team_id === match.away_team_id),
    )
    .sort(
      (a, b) =>
        (a.minute ?? Infinity) - (b.minute ?? Infinity) ||
        a.id.localeCompare(b.id),
    );
  const hasScore = match.home_score != null && match.away_score != null;
  const date = match.scheduled_at ? new Date(match.scheduled_at) : null;
  return (
    <dialog
      ref={dialog}
      className="match-details"
      aria-labelledby="match-details-title"
      onCancel={onClose}
    >
      <header>
        <div>
          <p className="eyebrow">DETALHES DA PARTIDA</p>
          <h2 id="match-details-title">
            {home?.name || "Time removido"} × {away?.name || "Time removido"}
          </h2>
        </div>
        <button
          className="icon-btn"
          aria-label="Fechar detalhes"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <p>
        {match.bracket_stage || `Rodada ${match.round}`}
        {!match.bracket_stage &&
        home?.group_name &&
        home.group_name === away?.group_name
          ? ` · Grupo ${home.group_name}`
          : ""}{" "}
        · {matchStatus(match.status)}
      </p>
      <p>
        {date && Number.isFinite(date.getTime())
          ? date.toLocaleString("pt-BR", {
              dateStyle: "long",
              timeStyle: "short",
            })
          : "Sem horário definido"}
      </p>
      <p>
        Local: {match.venue || "Não definido"}
        {match.duration_minutes
          ? ` · Duração prevista: ${match.duration_minutes} minutos`
          : ""}
      </p>
      <div className="detail-score" aria-label="Placar">
        {hasScore ? `${match.home_score} × ${match.away_score}` : "— × —"}
      </div>
      {hasScore && !["finalizado", "em_andamento"].includes(match.status) && (
        <p>
          Placar preservado de um lançamento anterior. A partida não está
          finalizada.
        </p>
      )}
      {match.bracket_stage &&
        match.penalty_home_score != null &&
        match.penalty_away_score != null && (
          <p>
            Pênaltis: {match.penalty_home_score} × {match.penalty_away_score}
          </p>
        )}
      {loading ? (
        <p role="status">Carregando registros…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button className="btn secondary" onClick={retry}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <h3>Eventos da partida</h3>
          <p className="muted">
            Gols e assistências são registros separados do placar. Eventos sem
            minuto aparecem no final.
          </p>
          {records.length ? (
            <ol className="detail-events">
              {records.map((e) => {
                const player = players.find(
                  (p) => p.id === e.player_id && p.team_id === e.team_id,
                );
                return (
                  <li key={e.id}>
                    <b>{e.minute == null ? "Sem minuto" : `${e.minute}′`}</b>
                    <span>
                      <strong>{labels[e.event_type] || "Evento"}</strong>
                      <span>
                        {player?.name || "Jogador não identificado"} ·{" "}
                        {teams.find((t) => t.id === e.team_id)?.name ||
                          "Time removido"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p>Nenhum evento registrado nesta partida.</p>
          )}
          <h3>Elencos cadastrados</h3>
          <p className="muted">
            Esta lista mostra o elenco atual de cada time; não confirma quem
            participou da partida.
          </p>
          <div className="detail-rosters">
            {[match.home_team_id, match.away_team_id].map((id) => (
              <section key={id}>
                <h4>
                  {teams.find((t) => t.id === id)?.name || "Time removido"}
                </h4>
                {players.some((p) => p.team_id === id) ? (
                  <ul>
                    {players
                      .filter((p) => p.team_id === id)
                      .sort(
                        (a, b) =>
                          (a.shirt_number ?? Infinity) -
                            (b.shirt_number ?? Infinity) ||
                          a.name.localeCompare(b.name, "pt-BR"),
                      )
                      .map((p) => (
                        <li key={p.id}>
                          {p.shirt_number == null ? "" : `#${p.shirt_number} `}
                          {p.name}
                          {p.position ? ` · ${p.position}` : ""}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>Nenhum jogador cadastrado.</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </dialog>
  );
}

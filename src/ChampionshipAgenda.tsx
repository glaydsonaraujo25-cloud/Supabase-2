import { useEffect, useState } from "react";
import {
  buildCalendar,
  downloadCalendar,
  upcomingMatches,
  type AgendaMatch,
} from "./lib/calendar";
export default function ChampionshipAgenda({
  championship,
  teams,
  matches,
}: {
  championship: { id: string; name: string };
  teams: { id: string; name: string }[];
  matches: AgendaMatch[];
}) {
  const [now, setNow] = useState(Date.now),
    [team, setTeam] = useState(""),
    [limit, setLimit] = useState(5),
    [feedback, setFeedback] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const selected = matches.filter(
    (m) => !team || m.home_team_id === team || m.away_team_id === team,
  );
  const upcoming = upcomingMatches(selected, now),
    live = selected.filter((m) => m.status === "em_andamento");
  const pending = selected.filter(
    (m) =>
      m.status === "agendado" &&
      (!m.scheduled_at ||
        !Number.isFinite(Date.parse(m.scheduled_at)) ||
        Date.parse(m.scheduled_at) < now),
  );
  const name = (id: string) => teams.find((t) => t.id === id)?.name || "Time";
  async function exportCalendar() {
    try {
      downloadCalendar(
        buildCalendar(championship, teams, selected, new Date()),
      );
      setFeedback(
        "Arquivo baixado. Importe-o no seu aplicativo de calendário.",
      );
    } catch {
      setFeedback("Não foi possível baixar a agenda. Tente novamente.");
    }
  }
  return (
    <section
      className="panel championship-agenda"
      aria-label="Agenda do campeonato"
    >
      <div className="panel-head">
        <div>
          <p className="eyebrow">AGENDA</p>
          <h3>Próximas partidas</h3>
        </div>
        <button
          className="btn secondary"
          disabled={!upcoming.length}
          onClick={() => void exportCalendar()}
        >
          Baixar agenda (.ics)
        </button>
      </div>
      <label>
        Agenda por time
        <select
          value={team}
          onChange={(e) => {
            setTeam(e.target.value);
            setLimit(5);
            setFeedback("");
          }}
        >
          <option value="">Todos os times</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {live.length > 0 && (
        <div className="agenda-live">
          <h4>Em andamento</h4>
          {live.map((m) => (
            <p key={m.id}>
              {name(m.home_team_id)} × {name(m.away_team_id)}
            </p>
          ))}
        </div>
      )}
      {upcoming.length ? (
        <ol className="agenda-list">
          {upcoming.slice(0, limit).map((m) => (
            <li key={m.id}>
              <time dateTime={m.scheduled_at!}>
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(m.scheduled_at!))}
              </time>
              <div>
                <strong>
                  {name(m.home_team_id)} × {name(m.away_team_id)}
                </strong>
                <small>
                  {m.bracket_stage || `Rodada ${m.round}`}
                  {m.venue ? ` · ${m.venue}` : ""}
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">
          Nenhuma partida futura agendada para esta seleção.
        </p>
      )}
      {upcoming.length > limit && (
        <button
          className="btn secondary small"
          onClick={() => setLimit((v) => v + 5)}
        >
          Mostrar mais partidas
        </button>
      )}
      {pending.length > 0 && (
        <p className="notice">
          {pending.length} partida(s) aguardando definição de horário ou
          atualização do status.
        </p>
      )}
      <p className="muted agenda-help">
        Horários no fuso do seu dispositivo. O arquivo inclui todos os jogos
        futuros agendados da seleção, inclusive mata-mata. É uma cópia:
        alterações posteriores precisam ser atualizadas no seu calendário.
      </p>
      {feedback && <p role="status">{feedback}</p>}
    </section>
  );
}

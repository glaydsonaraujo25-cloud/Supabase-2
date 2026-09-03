import "./statistics.css";
import { calculateStandings } from "./lib/competition";
import { fetchAll } from "./lib/data";
import { useModal } from "./lib/useModal";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BarChart3, Plus, Trash2, X } from "lucide-react";
import { supabase } from "./lib/supabase";

type Championship = { id: string; owner_id: string; name: string };
type Team = {
  id: string;
  championship_id: string;
  name: string;
  short_name: string | null;
};
type Player = {
  id: string;
  team_id: string;
  name: string;
  shirt_number: number | null;
  position: string | null;
};
type Match = {
  bracket_stage: string | null;
  id: string;
  championship_id: string;
  home_team_id: string;
  away_team_id: string;
  round: number;
  status: string;
  home_score: number | null;
  away_score: number | null;
};
type EventType = "goal" | "assist" | "yellow_card" | "red_card";
type MatchEvent = {
  id: string;
  championship_id: string;
  match_id: string;
  team_id: string;
  player_id: string | null;
  event_type: EventType;
  minute: number | null;
  created_at: string;
};

type PlayerStat = {
  player: Player;
  team: Team | null;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
};

type TeamStat = {
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

export default function StatisticsCenter({
  championshipId,
  onClose,
}: {
  championshipId: string;
  onClose: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null),
    [open, setOpen] = useState(true),
    [championships, setChampionships] = useState<Championship[]>([]),
    [selectedId, setSelectedId] = useState(championshipId),
    [teams, setTeams] = useState<Team[]>([]),
    [players, setPlayers] = useState<Player[]>([]),
    [matches, setMatches] = useState<Match[]>([]),
    [events, setEvents] = useState<MatchEvent[]>([]),
    [loading, setLoading] = useState(false),
    [feedback, setFeedback] = useState("");
  const modalRef = useModal(onClose, !!session);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session) void loadChampionships();
  }, [session?.user.id]);
  async function loadChampionships() {
    if (!session?.user.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("championships")
      .select("id,owner_id,name")
      .eq("id", championshipId)
      .order("created_at", { ascending: false });
    if (error) setFeedback(error.message);
    else {
      const list = (data || []) as Championship[];
      setChampionships(list);
      const next =
        selectedId && list.some((c) => c.id === selectedId)
          ? selectedId
          : list[0]?.id || "";
      setSelectedId(next);
      if (next) await loadStats(next);
    }
    setLoading(false);
  }
  async function loadStats(championshipId: string) {
    setLoading(true);
    setFeedback("");
    try {
      const [ts, ms, es] = await Promise.all([
        fetchAll(() =>
          supabase
            .from("teams")
            .select("*")
            .eq("championship_id", championshipId)
            .order("id"),
        ),
        fetchAll(() =>
          supabase
            .from("matches")
            .select("*")
            .eq("championship_id", championshipId)
            .order("round")
            .order("id"),
        ),
        fetchAll(() =>
          supabase
            .from("match_events")
            .select("*")
            .eq("championship_id", championshipId)
            .order("created_at")
            .order("id"),
        ),
      ]);
      const ids = ts.map((t) => t.id);
      const ps = ids.length
        ? await fetchAll(() =>
            supabase.from("players").select("*").in("team_id", ids).order("id"),
          )
        : [];
      setTeams(ts as Team[]);
      setPlayers(ps as Player[]);
      setMatches(ms as Match[]);
      setEvents(es as MatchEvent[]);
    } catch (e) {
      setFeedback((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function show() {
    setOpen(true);
    setFeedback("");
    await loadChampionships();
  }
  const selected = championships.find((c) => c.id === selectedId) || null,
    isOwner = !!selected && selected.owner_id === session?.user.id;
  const playerStats = useMemo(
    () => calculatePlayerStats(players, teams, events),
    [players, teams, events],
  );
  const teamStats = useMemo(
    () => calculateTeamStats(teams, matches),
    [teams, matches],
  );
  return (
    <>
      {open && (
        <div className="stats-backdrop" onClick={() => onClose()}>
          <section
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="StatisticsCenter"
            className="stats-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">DESEMPENHO</p>
                <h2>Estatísticas do campeonato</h2>
              </div>
              <button
                aria-label="Fechar"
                className="icon-btn"
                onClick={() => onClose()}
              >
                <X size={18} />
              </button>
            </header>
            {championships.length > 0 && (
              <select
                className="stats-select"
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  void loadStats(e.target.value);
                }}
              >
                {championships.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.owner_id === session?.user.id ? "★ " : ""}
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {feedback && <div className="notice">{feedback}</div>}
            {loading ? (
              <p>Carregando estatísticas…</p>
            ) : !selected ? (
              <p className="muted">Nenhum campeonato disponível.</p>
            ) : (
              <div className="stats-content">
                {isOwner && (
                  <EventForm
                    championshipId={selected.id}
                    teams={teams}
                    players={players}
                    matches={matches}
                    reload={() => loadStats(selected.id)}
                    setFeedback={setFeedback}
                  />
                )}
                <section className="stats-grid">
                  <article className="stats-panel">
                    <p className="eyebrow">ARTILHARIA</p>
                    <h3>Gols</h3>
                    <Ranking
                      rows={playerStats
                        .filter((x) => x.goals > 0)
                        .sort(
                          (a, b) => b.goals - a.goals || b.assists - a.assists,
                        )}
                      value={(x) => x.goals}
                      suffix="gols"
                    />
                  </article>
                  <article className="stats-panel">
                    <p className="eyebrow">ASSISTÊNCIAS</p>
                    <h3>Passes para gol</h3>
                    <Ranking
                      rows={playerStats
                        .filter((x) => x.assists > 0)
                        .sort(
                          (a, b) => b.assists - a.assists || b.goals - a.goals,
                        )}
                      value={(x) => x.assists}
                      suffix="assist."
                    />
                  </article>
                  <article className="stats-panel">
                    <p className="eyebrow">DISCIPLINA</p>
                    <h3>Cartões</h3>
                    {playerStats.some((x) => x.yellow || x.red) ? (
                      <div className="discipline-list">
                        {playerStats
                          .filter((x) => x.yellow || x.red)
                          .sort(
                            (a, b) =>
                              b.red * 3 + b.yellow - (a.red * 3 + a.yellow),
                          )
                          .map((x) => (
                            <div key={x.player.id}>
                              <span>
                                <strong>{x.player.name}</strong>
                                <small>{x.team?.name || "Time"}</small>
                              </span>
                              <b>
                                🟨 {x.yellow} · 🟥 {x.red}
                              </b>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="muted">Nenhum cartão registrado.</p>
                    )}
                  </article>
                </section>
                <section className="stats-panel">
                  <p className="eyebrow">TIMES</p>
                  <h3>Desempenho</h3>
                  <div className="stats-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>PTS</th>
                          <th>J</th>
                          <th>V</th>
                          <th>E</th>
                          <th>D</th>
                          <th>GP</th>
                          <th>GC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamStats.map((r) => (
                          <tr key={r.team.id}>
                            <td>
                              <strong>{r.team.name}</strong>
                            </td>
                            <td>{r.points}</td>
                            <td>{r.played}</td>
                            <td>{r.wins}</td>
                            <td>{r.draws}</td>
                            <td>{r.losses}</td>
                            <td>{r.goalsFor}</td>
                            <td>{r.goalsAgainst}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                {isOwner && events.length > 0 && (
                  <section className="stats-panel">
                    <p className="eyebrow">EVENTOS</p>
                    <h3>Registros recentes</h3>
                    <div className="event-list">
                      {[...events]
                        .reverse()
                        .slice(0, 30)
                        .map((ev) => {
                          const p = players.find((x) => x.id === ev.player_id),
                            t = teams.find((x) => x.id === ev.team_id),
                            m = matches.find((x) => x.id === ev.match_id);
                          return (
                            <div key={ev.id}>
                              <span>
                                <strong>
                                  {eventLabel(ev.event_type)}
                                  {p ? ` · ${p.name}` : ""}
                                </strong>
                                <small>
                                  {t?.name || "Time"} · Rodada {m?.round ?? "—"}
                                  {ev.minute !== null ? ` · ${ev.minute}'` : ""}
                                </small>
                              </span>
                              <button
                                className="icon-btn danger"
                                onClick={async () => {
                                  const { error } = await supabase
                                    .from("match_events")
                                    .delete()
                                    .eq("id", ev.id);
                                  if (error) setFeedback(error.message);
                                  else await loadStats(selected.id);
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </section>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function EventForm({
  championshipId,
  teams,
  players,
  matches,
  reload,
  setFeedback,
}: {
  championshipId: string;
  teams: Team[];
  players: Player[];
  matches: Match[];
  reload: () => Promise<void>;
  setFeedback: (s: string) => void;
}) {
  const [matchId, setMatchId] = useState(""),
    [teamId, setTeamId] = useState(""),
    [playerId, setPlayerId] = useState(""),
    [eventType, setEventType] = useState<EventType>("goal"),
    [minute, setMinute] = useState(""),
    [busy, setBusy] = useState(false);
  const match = matches.find((m) => m.id === matchId),
    allowedTeams = match
      ? teams.filter(
          (t) => t.id === match.home_team_id || t.id === match.away_team_id,
        )
      : [],
    allowedPlayers = players.filter((p) => p.team_id === teamId);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setFeedback("");
    if (!matchId || !teamId || !playerId)
      return setFeedback("Selecione partida, time e jogador.");
    setBusy(true);
    const { error } = await supabase.from("match_events").insert({
      championship_id: championshipId,
      match_id: matchId,
      team_id: teamId,
      player_id: playerId,
      event_type: eventType,
      minute: minute ? Number(minute) : null,
    });
    if (error) setFeedback(error.message);
    else {
      setPlayerId("");
      setMinute("");
      await reload();
    }
    setBusy(false);
  }
  return (
    <form className="stats-panel event-form" onSubmit={submit}>
      <div>
        <p className="eyebrow">NOVO EVENTO</p>
        <h3>Registrar estatística</h3>
      </div>
      <label>
        Partida
        <select
          value={matchId}
          onChange={(e) => {
            setMatchId(e.target.value);
            setTeamId("");
            setPlayerId("");
          }}
          required
        >
          <option value="">Selecione</option>
          {matches
            .filter((m) => m.status !== "cancelado")
            .map((m) => (
              <option key={m.id} value={m.id}>
                Rodada {m.round} ·{" "}
                {teams.find((t) => t.id === m.home_team_id)?.name || "Time"} ×{" "}
                {teams.find((t) => t.id === m.away_team_id)?.name || "Time"}
              </option>
            ))}
        </select>
      </label>
      <label>
        Time
        <select
          value={teamId}
          onChange={(e) => {
            setTeamId(e.target.value);
            setPlayerId("");
          }}
          required
        >
          <option value="">Selecione</option>
          {allowedTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Jogador
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          required
        >
          <option value="">Selecione</option>
          {allowedPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.shirt_number !== null ? `#${p.shirt_number} ` : ""}
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Evento
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value as EventType)}
        >
          <option value="goal">Gol</option>
          <option value="assist">Assistência</option>
          <option value="yellow_card">Cartão amarelo</option>
          <option value="red_card">Cartão vermelho</option>
        </select>
      </label>
      <label>
        Minuto
        <input
          type="number"
          min={0}
          max={150}
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
          placeholder="Opcional"
        />
      </label>
      <button className="btn primary" disabled={busy}>
        <Plus size={16} />
        {busy ? "Salvando…" : "Registrar"}
      </button>
    </form>
  );
}

function Ranking({
  rows,
  value,
  suffix,
}: {
  rows: PlayerStat[];
  value: (x: PlayerStat) => number;
  suffix: string;
}) {
  return rows.length ? (
    <div className="stats-ranking">
      {rows.slice(0, 10).map((x, i) => (
        <div key={x.player.id}>
          <b>{i + 1}</b>
          <span>
            <strong>{x.player.name}</strong>
            <small>{x.team?.name || "Time"}</small>
          </span>
          <em>
            {value(x)} {suffix}
          </em>
        </div>
      ))}
    </div>
  ) : (
    <p className="muted">Nenhum registro ainda.</p>
  );
}
function eventLabel(t: EventType) {
  return t === "goal"
    ? "Gol"
    : t === "assist"
      ? "Assistência"
      : t === "yellow_card"
        ? "Cartão amarelo"
        : "Cartão vermelho";
}
function calculatePlayerStats(
  players: Player[],
  teams: Team[],
  events: MatchEvent[],
): PlayerStat[] {
  return players.map((player) => {
    const e = events.filter((x) => x.player_id === player.id);
    return {
      player,
      team: teams.find((t) => t.id === player.team_id) || null,
      goals: e.filter((x) => x.event_type === "goal").length,
      assists: e.filter((x) => x.event_type === "assist").length,
      yellow: e.filter((x) => x.event_type === "yellow_card").length,
      red: e.filter((x) => x.event_type === "red_card").length,
    };
  });
}
function calculateTeamStats(teams: Team[], matches: Match[]): TeamStat[] {
  return calculateStandings(teams, matches);
}

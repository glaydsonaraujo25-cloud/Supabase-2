import { fetchAll } from "./lib/data";
import {
  isLeagueMatch,
  matchStatus,
  calculateStandings,
} from "./lib/competition";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { publicSupabase as supabase } from "./lib/supabase";

type C = {
  id: string;
  name: string;
  sport: string;
  format: string;
  status: string;
  public_slug: string;
};
type T = {
  id: string;
  championship_id: string;
  name: string;
  short_name: string | null;
  city: string | null;
};
type P = {
  id: string;
  team_id: string;
  name: string;
  shirt_number: number | null;
  position: string | null;
};
type M = {
  bracket_stage: string | null;
  penalty_home_score: number | null;
  penalty_away_score: number | null;
  id: string;
  championship_id: string;
  home_team_id: string;
  away_team_id: string;
  round: number;
  scheduled_at: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
};
type E = {
  id: string;
  championship_id: string;
  match_id: string;
  team_id: string;
  player_id: string | null;
  event_type: "goal" | "assist" | "yellow_card" | "red_card";
  minute: number | null;
};

export default function PublicChampionship({ slug }: { slug: string }) {
  const [c, setC] = useState<C | null>(null),
    [teams, setTeams] = useState<T[]>([]),
    [players, setPlayers] = useState<P[]>([]),
    [matches, setMatches] = useState<M[]>([]),
    [events, setEvents] = useState<E[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data: champ, error: failure } = await supabase
        .from("championships")
        .select("id,name,sport,format,status,public_slug")
        .eq("public_slug", slug)
        .eq("is_public", true)
        .maybeSingle();
      if (failure) throw failure;
      if (!champ) throw new Error("Campeonato indisponível.");
      const [ts, ms, es] = await Promise.all([
        fetchAll(() =>
          supabase
            .from("teams")
            .select("id,championship_id,name,short_name,city")
            .eq("championship_id", champ.id)
            .order("name")
            .order("id"),
        ),
        fetchAll(() =>
          supabase
            .from("matches")
            .select(
              "id,championship_id,home_team_id,away_team_id,round,scheduled_at,status,home_score,away_score,bracket_stage,penalty_home_score,penalty_away_score",
            )
            .eq("championship_id", champ.id)
            .order("round")
            .order("id"),
        ),
        fetchAll(() =>
          supabase
            .from("match_events")
            .select(
              "id,championship_id,match_id,team_id,player_id,event_type,minute",
            )
            .eq("championship_id", champ.id)
            .order("id"),
        ),
      ]);
      const ids = ts.map((t) => t.id),
        ps = ids.length
          ? await fetchAll(() =>
              supabase
                .from("players")
                .select("id,team_id,name,shirt_number,position")
                .in("team_id", ids)
                .order("id"),
            )
          : [];
      setC(champ as C);
      setTeams(ts as T[]);
      setMatches(ms as M[]);
      setEvents(es as E[]);
      setPlayers(ps as P[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [slug]);
  const table = useMemo(
      () => standings(teams, matches.filter(isLeagueMatch)),
      [teams, matches],
    ),
    playerStats = useMemo(
      () => stats(players, teams, events),
      [players, teams, events],
    ),
    name = (id: string) => teams.find((t) => t.id === id)?.name || "Time";
  const scorers = [...playerStats]
      .filter((x) => x.goals > 0)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists),
    assists = [...playerStats]
      .filter((x) => x.assists > 0)
      .sort((a, b) => b.assists - a.assists || b.goals - a.goals),
    cards = [...playerStats]
      .filter((x) => x.yellow || x.red)
      .sort((a, b) => b.red * 3 + b.yellow - (a.red * 3 + a.yellow));
  if (loading) return <div className="public-center">Carregando…</div>;
  if (error || !c)
    return (
      <div className="public-center">
        <div className="public-card">
          <Trophy />
          <h2>Campeonato indisponível</h2>
          <p>{error}</p>
          <a href="/">Voltar ao Bracketly</a>
        </div>
      </div>
    );
  return (
    <div className="public-page">
      <header>
        <a href="/">
          <Trophy size={20} /> Bracketly
        </a>
        <button onClick={() => void load()}>
          <RefreshCw size={15} /> Atualizar
        </button>
      </header>
      <main>
        <section className="public-hero">
          <span>{label(c.status)}</span>
          <h1>{c.name}</h1>
          <p>
            {c.sport} · {c.format}
          </p>
        </section>
        <section className="public-columns">
          <article className="public-card">
            <h2>
              {c.format === "Mata-mata" ? "Fase eliminatória" : "Classificação"}
            </h2>
            {c.format === "Mata-mata" && (
              <p>Confira os confrontos e os vencedores abaixo.</p>
            )}
            {c.format !== "Mata-mata" && (
              <div className="public-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Time</th>
                      <th>PTS</th>
                      <th>J</th>
                      <th>V</th>
                      <th>E</th>
                      <th>D</th>
                      <th>SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.name}</td>
                        <td>
                          <b>{r.pts}</b>
                        </td>
                        <td>{r.j}</td>
                        <td>{r.v}</td>
                        <td>{r.e}</td>
                        <td>{r.d}</td>
                        <td>{r.sg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
          <article className="public-card">
            <h2>Times</h2>
            {teams.map((t) => (
              <div className="public-team" key={t.id}>
                <b>{t.short_name || t.name.slice(0, 3).toUpperCase()}</b>
                <span>
                  <strong>{t.name}</strong>
                  <small>{t.city || "Cidade não informada"}</small>
                </span>
              </div>
            ))}
          </article>
        </section>
        <section className="public-stats-grid">
          <article className="public-card">
            <h2>Artilharia</h2>
            <PublicRanking rows={scorers} kind="goals" />
          </article>
          <article className="public-card">
            <h2>Assistências</h2>
            <PublicRanking rows={assists} kind="assists" />
          </article>
          <article className="public-card">
            <h2>Cartões</h2>
            {cards.length ? (
              <div className="public-stat-list">
                {cards.slice(0, 10).map((x, i) => (
                  <div key={x.player.id}>
                    <b>{i + 1}</b>
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
              <p>Nenhum cartão registrado.</p>
            )}
          </article>
        </section>
        <article className="public-card">
          <h2>Partidas</h2>
          {matches.length ? (
            matches.map((m) => (
              <div className="public-match" key={m.id}>
                <span>
                  <small>
                    {m.bracket_stage || `Rodada ${m.round}`}
                    {m.scheduled_at
                      ? " · " + new Date(m.scheduled_at).toLocaleString("pt-BR")
                      : ""}
                  </small>
                  <strong>
                    {name(m.home_team_id)} × {name(m.away_team_id)}
                  </strong>
                </span>
                <b>
                  {(m.status === "finalizado" || m.status === "em_andamento") &&
                  m.home_score !== null &&
                  m.away_score !== null
                    ? `${m.home_score} × ${m.away_score}`
                    : matchStatus(m.status)}
                  <small>
                    {" "}
                    · {matchStatus(m.status)}
                    {m.penalty_home_score !== null &&
                    m.penalty_away_score !== null
                      ? ` · Pênaltis ${m.penalty_home_score} × ${m.penalty_away_score}`
                      : ""}
                  </small>
                </b>
              </div>
            ))
          ) : (
            <p>Nenhuma partida cadastrada.</p>
          )}
        </article>
      </main>
    </div>
  );
}

function PublicRanking({
  rows,
  kind,
}: {
  rows: ReturnType<typeof stats>;
  kind: "goals" | "assists";
}) {
  return rows.length ? (
    <div className="public-stat-list">
      {rows.slice(0, 10).map((x, i) => (
        <div key={x.player.id}>
          <b>{i + 1}</b>
          <span>
            <strong>{x.player.name}</strong>
            <small>{x.team?.name || "Time"}</small>
          </span>
          <b>{kind === "goals" ? `${x.goals} gols` : `${x.assists} assist.`}</b>
        </div>
      ))}
    </div>
  ) : (
    <p>Nenhum registro ainda.</p>
  );
}
function label(s: string) {
  return s === "aberto"
    ? "Inscrições abertas"
    : s === "em_andamento"
      ? "Em andamento"
      : s === "finalizado"
        ? "Finalizado"
        : "Rascunho";
}
function stats(ps: P[], ts: T[], es: E[]) {
  return ps.map((player) => {
    const e = es.filter((x) => x.player_id === player.id);
    return {
      player,
      team: ts.find((t) => t.id === player.team_id) || null,
      goals: e.filter((x) => x.event_type === "goal").length,
      assists: e.filter((x) => x.event_type === "assist").length,
      yellow: e.filter((x) => x.event_type === "yellow_card").length,
      red: e.filter((x) => x.event_type === "red_card").length,
    };
  });
}
function standings(ts: T[], ms: M[]) {
  return calculateStandings(ts, ms).map((r) => ({
    id: r.team.id,
    name: r.team.name,
    pts: r.points,
    j: r.played,
    v: r.wins,
    e: r.draws,
    d: r.losses,
    gp: r.goalsFor,
    gc: r.goalsAgainst,
    sg: r.goalDiff,
  }));
}

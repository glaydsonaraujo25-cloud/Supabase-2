import { calculateStandings } from "./competition";
import type {
  DetailMatch,
  DetailPlayer,
  DetailEvent,
  DetailTeam,
} from "../MatchDetails";
export function championshipResult(
  format: string,
  teams: DetailTeam[],
  matches: DetailMatch[],
) {
  const active = matches.filter((m) => m.status !== "cancelado");
  if (
    !active.length ||
    active.some(
      (m) =>
        m.status !== "finalizado" ||
        m.home_score == null ||
        m.away_score == null,
    )
  )
    return {
      message: "Ainda há resultados pendentes ou nenhuma partida finalizada.",
    };
  if (format === "Pontos corridos") {
    const league = active.filter((m) => !m.bracket_stage);
    const complete =
      teams.length >= 2 &&
      teams.every((a, i) =>
        teams
          .slice(i + 1)
          .every((b) =>
            league.some(
              (m) =>
                (m.home_team_id === a.id && m.away_team_id === b.id) ||
                (m.home_team_id === b.id && m.away_team_id === a.id),
            ),
          ),
      );
    if (!complete)
      return {
        message:
          "Faltam confrontos finalizados entre os times para definir o resultado da liga.",
      };
    const rows = calculateStandings(teams, league);
    return {
      champion: rows[0].team,
      runnerUp: rows[1].team,
      message: "Resultado conforme os critérios da tabela de classificação.",
    };
  }
  const finals = active.filter((m) => m.bracket_stage === "Final");
  if (finals.length !== 1)
    return {
      message: "A final do mata-mata ainda não está definida ou foi cancelada.",
    };
  const final = finals[0];
  let winner: string | undefined;
  if (final.home_score! > final.away_score!) winner = final.home_team_id;
  else if (final.away_score! > final.home_score!) winner = final.away_team_id;
  else if (
    final.penalty_home_score != null &&
    final.penalty_away_score != null &&
    final.penalty_home_score !== final.penalty_away_score
  )
    winner =
      final.penalty_home_score > final.penalty_away_score
        ? final.home_team_id
        : final.away_team_id;
  const champion = teams.find((t) => t.id === winner),
    runnerUp = teams.find(
      (t) =>
        t.id ===
        (winner === final.home_team_id
          ? final.away_team_id
          : final.home_team_id),
    );
  if (!champion || !runnerUp)
    return { message: "Confira os times e a decisão por pênaltis da final." };
  return { champion, runnerUp, message: "Resultado da final do mata-mata." };
}
export function topScorers(
  players: DetailPlayer[],
  events: DetailEvent[],
  matches: DetailMatch[],
) {
  const finished = new Map(
    matches.filter((m) => m.status === "finalizado").map((m) => [m.id, m]),
  );
  const byId = new Map(players.map((p) => [p.id, p]));
  const goals = new Map<string, number>();
  for (const event of events) {
    const match = finished.get(event.match_id),
      player = event.player_id ? byId.get(event.player_id) : undefined;
    if (
      event.event_type !== "goal" ||
      !match ||
      !player ||
      player.team_id !== event.team_id ||
      ![match.home_team_id, match.away_team_id].includes(event.team_id)
    )
      continue;
    goals.set(player.id, (goals.get(player.id) || 0) + 1);
  }
  const maximum = Math.max(0, ...goals.values());
  return [...goals]
    .filter(([, n]) => n === maximum)
    .map(([id, n]) => ({ player: byId.get(id)!, goals: n }))
    .sort((a, b) => a.player.name.localeCompare(b.player.name, "pt-BR"));
}

export function isLeagueMatch(match: { bracket_stage?: string | null }) {
  return !match.bracket_stage;
}
export function matchStatus(status: string) {
  return (
    (
      {
        agendado: "Agendado",
        em_andamento: "Em andamento",
        finalizado: "Finalizado",
        cancelado: "Cancelado",
      } as Record<string, string>
    )[status] || "Status desconhecido"
  );
}
export function validScore(value: string) {
  return (
    value.trim() !== "" && Number.isInteger(Number(value)) && Number(value) >= 0
  );
}

export type FormResult = {
  result: "V" | "E" | "D";
  round?: number;
  opponent: string;
  score: string;
};

export type ScoreMatch = {
  id?: string;
  round?: number;
  home_team_id: string;
  away_team_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  bracket_stage?: string | null;
};
export function calculateStandings<T extends { id: string; name: string }>(
  teams: T[],
  matches: ScoreMatch[],
) {
  const rows = new Map(
    teams.map((team) => [
      team.id,
      {
        team,
        points: 0,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        percentage: null as number | null,
        form: [] as FormResult[],
      },
    ]),
  );
  for (const match of [...matches].sort(
    (a, b) =>
      (a.round ?? 0) - (b.round ?? 0) || (a.id ?? "").localeCompare(b.id ?? ""),
  )) {
    if (
      !isLeagueMatch(match) ||
      match.status !== "finalizado" ||
      match.home_score === null ||
      match.away_score === null
    )
      continue;
    const home = rows.get(match.home_team_id),
      away = rows.get(match.away_team_id);
    if (!home || !away) continue;
    const h = match.home_score,
      a = match.away_score;
    home.form.push({
      result: h > a ? "V" : h === a ? "E" : "D",
      round: match.round,
      opponent: away.team.name,
      score: `${h} × ${a}`,
    });
    away.form.push({
      result: a > h ? "V" : a === h ? "E" : "D",
      round: match.round,
      opponent: home.team.name,
      score: `${a} × ${h}`,
    });
    home.played++;
    away.played++;
    home.goalsFor += h;
    home.goalsAgainst += a;
    away.goalsFor += a;
    away.goalsAgainst += h;
    if (h > a) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (a > h) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
      home.points++;
      away.points++;
    }
  }
  for (const row of rows.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
    row.percentage = row.played ? (row.points / (row.played * 3)) * 100 : null;
    row.form = row.form.slice(-5);
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.team.name.localeCompare(b.team.name, "pt-BR"),
  );
}

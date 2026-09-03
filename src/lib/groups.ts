import { calculateStandings, type ScoreMatch } from "./competition";
export type GroupTeam = {
  id: string;
  name: string;
  group_name?: string | null;
};
export const hasGroups = (teams: GroupTeam[]) =>
  teams.some((t) => !!t.group_name);
export function groupTables(teams: GroupTeam[], matches: ScoreMatch[]) {
  return [
    ...new Set(teams.map((t) => t.group_name).filter(Boolean) as string[]),
  ]
    .sort()
    .map((name) => {
      const members = teams.filter((t) => t.group_name === name);
      const ids = new Set(members.map((t) => t.id));
      const games = matches.filter(
        (m) =>
          !m.bracket_stage &&
          ids.has(m.home_team_id) &&
          ids.has(m.away_team_id),
      );
      const rows = calculateStandings(members, games).sort(
        (a, b) =>
          b.points - a.points ||
          b.wins - a.wins ||
          b.goalDiff - a.goalDiff ||
          b.goalsFor - a.goalsFor ||
          (a.team.name < b.team.name
            ? -1
            : a.team.name > b.team.name
              ? 1
              : a.team.id < b.team.id
                ? -1
                : 1),
      );
      const complete =
        members.length >= 2 &&
        members.every((a, i) =>
          members
            .slice(i + 1)
            .every((b) =>
              games.some(
                (m) =>
                  m.status === "finalizado" &&
                  ((m.home_team_id === a.id && m.away_team_id === b.id) ||
                    (m.home_team_id === b.id && m.away_team_id === a.id)),
              ),
            ),
        ) &&
        games.every((m) => m.status === "finalizado");
      return { name, rows, complete };
    });
}
export function distributeGroups(teams: GroupTeam[], count: number) {
  return Object.fromEntries(
    [...teams]
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id),
      )
      .map((t, i) => [t.id, String.fromCharCode(65 + (i % count))]),
  );
}

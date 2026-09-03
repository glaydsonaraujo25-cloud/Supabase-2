import StandingsTable from "./StandingsTable";
import { groupTables, type GroupTeam } from "./lib/groups";
import type { ScoreMatch } from "./lib/competition";
export default function GroupStandings({
  teams,
  matches,
}: {
  teams: GroupTeam[];
  matches: ScoreMatch[];
}) {
  const groups = groupTables(teams, matches);
  return (
    <div className="group-tables">
      <p>
        Avançam os dois primeiros de cada grupo. Cruzamentos: 1º A × 2º B, 1º B
        × 2º A; o mesmo vale para C/D e E/F, G/H.
      </p>
      {teams.some((t) => !t.group_name) && (
        <p role="status">
          Há times sem grupo. Conclua a distribuição antes de gerar partidas.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.name} className="panel">
          <h3>Grupo {group.name}</h3>
          <p>
            {group.complete
              ? "Classificados"
              : "Nas posições de classificação (provisório)"}
            :{" "}
            {group.rows
              .slice(0, 2)
              .map((r) => r.team.name)
              .join(" e ")}
          </p>
          <StandingsTable rows={group.rows} />
        </section>
      ))}
    </div>
  );
}

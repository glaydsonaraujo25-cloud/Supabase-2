import { matchStatus } from "./lib/competition";
export default function MatchFilters({
  teams,
  team,
  status,
  onTeam,
  onStatus,
  count,
}: {
  teams: { id: string; name: string }[];
  team: string;
  status: string;
  onTeam: (v: string) => void;
  onStatus: (v: string) => void;
  count: number;
}) {
  return (
    <div className="panel match-filters">
      <label>
        Filtrar por time
        <select value={team} onChange={(e) => onTeam(e.target.value)}>
          <option value="">Todos os times</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Filtrar por status
        <select value={status} onChange={(e) => onStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {["agendado", "em_andamento", "finalizado", "cancelado"].map((s) => (
            <option key={s} value={s}>
              {matchStatus(s)}
            </option>
          ))}
        </select>
      </label>
      <span role="status">
        {count} partida{count === 1 ? "" : "s"}
      </span>
      {(team || status) && (
        <button
          className="btn secondary"
          onClick={() => {
            onTeam("");
            onStatus("");
          }}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

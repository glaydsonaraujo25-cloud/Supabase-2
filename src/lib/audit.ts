export type AuditEntry = {
  id: string;
  actor_id: string | null;
  entity: string;
  action: string;
  record_id: string | null;
  details: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  created_at: string;
};
const entities: Record<string, string> = {
  championships: "Campeonato",
  teams: "Time",
  players: "Jogador",
  matches: "Partida",
  match_events: "Evento",
};
const actions: Record<string, string> = {
  insert: "criou",
  update: "alterou",
  delete: "excluiu",
};
const fields: Record<string, string> = {
  name: "nome",
  sport: "modalidade",
  format: "formato",
  status: "status",
  start_date: "início",
  end_date: "término",
  max_teams: "limite de times",
  is_public: "visibilidade pública",
  short_name: "sigla",
  city: "cidade",
  group_name: "grupo",
  shirt_number: "camisa",
  position: "posição",
  round: "rodada",
  scheduled_at: "data e horário",
  home_score: "placar mandante",
  away_score: "placar visitante",
  penalty_home_score: "pênaltis mandante",
  penalty_away_score: "pênaltis visitante",
  venue: "local",
  duration_minutes: "duração",
  event_type: "tipo",
  minute: "minuto",
  home_team_id: "mandante",
  away_team_id: "visitante",
  team_id: "time",
  player_id: "jogador",
  match_id: "partida",
  bracket_stage: "fase eliminatória",
  bracket_position: "posição na chave",
};
export const auditTitle = (e: AuditEntry) =>
  `${actions[e.action] || e.action} ${entities[e.entity] || e.entity}`;
const value = (v: unknown) =>
  v === null || v === undefined || v === ""
    ? "não informado"
    : typeof v === "boolean"
      ? v
        ? "sim"
        : "não"
      : String(v);
export function auditChanges(entry: AuditEntry) {
  const before = entry.details.before || {},
    after = entry.details.after || {},
    keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((k) => before[k] !== after[k] && fields[k])
    .map((k) => ({
      field: fields[k],
      before: value(before[k]),
      after: value(after[k]),
    }));
}

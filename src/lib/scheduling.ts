export type ScheduledGame = {
  id: string;
  home_team_id?: string;
  away_team_id?: string;
  scheduled_at?: string | null;
  status: string;
  venue?: string | null;
  duration_minutes?: number | null;
};
const normalizedVenue = (s?: string | null) =>
  (s || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
export function scheduleConflicts(
  draft: ScheduledGame,
  games: ScheduledGame[],
) {
  if (draft.status === "cancelado" || !draft.scheduled_at) return [];
  const start = Date.parse(draft.scheduled_at);
  if (!Number.isFinite(start)) return [];
  const end = draft.duration_minutes
    ? start + draft.duration_minutes * 60000
    : start;
  return games.flatMap((game) => {
    if (
      game.id === draft.id ||
      game.status === "cancelado" ||
      !game.scheduled_at
    )
      return [];
    const other = Date.parse(game.scheduled_at),
      otherEnd = game.duration_minutes
        ? other + game.duration_minutes * 60000
        : other;
    const overlap =
      Number.isFinite(other) &&
      (start === other ||
        (start < other && other < end) ||
        (other < start && start < otherEnd));
    if (!overlap) return [];
    const sharedTeam = [draft.home_team_id, draft.away_team_id].some(
      (id) => !!id && (id === game.home_team_id || id === game.away_team_id),
    );
    const sharedVenue =
      !!normalizedVenue(draft.venue) &&
      normalizedVenue(draft.venue) === normalizedVenue(game.venue);
    return sharedTeam || sharedVenue ? [{ game, sharedTeam, sharedVenue }] : [];
  });
}

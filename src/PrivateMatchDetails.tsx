import { useEffect, useState } from "react";
import MatchDetails, {
  type DetailMatch,
  type DetailTeam,
  type DetailPlayer,
  type DetailEvent,
} from "./MatchDetails";
import { supabase } from "./lib/supabase";
import { fetchAll } from "./lib/data";
export default function PrivateMatchDetails({
  match,
  teams,
  onClose,
}: {
  match: DetailMatch;
  teams: DetailTeam[];
  onClose: () => void;
}) {
  const [players, setPlayers] = useState<DetailPlayer[]>([]),
    [events, setEvents] = useState<DetailEvent[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setPlayers([]);
    setEvents([]);
    Promise.all([
      fetchAll(() =>
        supabase
          .from("match_events")
          .select("id,match_id,team_id,player_id,event_type,minute")
          .eq("championship_id", match.championship_id)
          .eq("match_id", match.id)
          .order("id"),
      ),
      fetchAll(() =>
        supabase
          .from("players")
          .select("id,team_id,name,shirt_number,position")
          .in("team_id", [match.home_team_id, match.away_team_id])
          .order("id"),
      ),
    ])
      .then(([es, ps]) => {
        if (active) {
          setEvents(es as DetailEvent[]);
          setPlayers(ps as DetailPlayer[]);
        }
      })
      .catch(() => {
        if (active)
          setError("Não foi possível carregar os registros da partida.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    match.id,
    match.championship_id,
    match.home_team_id,
    match.away_team_id,
    attempt,
  ]);
  return (
    <MatchDetails
      match={match}
      teams={teams}
      players={players}
      events={events}
      loading={loading}
      error={error}
      retry={() => setAttempt((v) => v + 1)}
      onClose={onClose}
    />
  );
}

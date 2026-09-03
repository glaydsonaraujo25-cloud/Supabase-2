import { useEffect, useState } from "react";
import ChampionshipResults, { type ResultsProps } from "./ChampionshipResults";
import { supabase } from "./lib/supabase";
import { fetchAll } from "./lib/data";
export default function PrivateChampionshipResults(
  props: Omit<ResultsProps, "events">,
) {
  const [events, setEvents] = useState<ResultsProps["events"]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (props.championship.status !== "finalizado") return;
    let active = true;
    setEvents([]);
    setLoading(true);
    setError("");
    fetchAll(() =>
      supabase
        .from("match_events")
        .select("id,match_id,team_id,player_id,event_type,minute")
        .eq("championship_id", props.championship.id)
        .eq("event_type", "goal")
        .order("id"),
    )
      .then((es) => {
        if (active) setEvents(es as ResultsProps["events"]);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar a artilharia.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    props.championship.id,
    props.championship.status,
    attempt,
    props.matches,
  ]);
  return (
    <ChampionshipResults
      {...props}
      events={events}
      loading={loading}
      error={error}
      retry={() => setAttempt((v) => v + 1)}
    />
  );
}

import { useEffect, useRef, useState } from "react";
import ChampionshipReport, { type ReportProps } from "./ChampionshipReport";
import ToolDialog from "./ToolDialog";
import { fetchAll } from "./lib/data";
import { supabase } from "./lib/supabase";
export default function PrivateChampionshipReport(
  props: Omit<ReportProps, "events">,
) {
  const [events, setEvents] = useState<ReportProps["events"]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0),
    version = useRef(0);
  useEffect(() => {
    const v = ++version.current;
    setLoading(true);
    setError("");
    fetchAll(() =>
      supabase
        .from("match_events")
        .select("id,match_id,team_id,player_id,event_type,minute")
        .eq("championship_id", props.championship.id)
        .order("id"),
    )
      .then((rows) => {
        if (v === version.current) setEvents(rows as ReportProps["events"]);
      })
      .catch(() => {
        if (v === version.current)
          setError("Não foi possível carregar os dados da artilharia.");
      })
      .finally(() => {
        if (v === version.current) setLoading(false);
      });
    return () => {
      version.current++;
    };
  }, [props.championship.id, attempt]);
  if (loading || error)
    return (
      <ToolDialog title="Preparar relatório" onClose={props.onClose}>
        {loading ? (
          <p role="status">Carregando dados…</p>
        ) : (
          <>
            <p role="alert">{error}</p>
            <button
              className="btn secondary"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Tentar novamente
            </button>
          </>
        )}
      </ToolDialog>
    );
  return <ChampionshipReport {...props} events={events} />;
}

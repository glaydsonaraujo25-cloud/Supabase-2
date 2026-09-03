import { hasGroups } from "./lib/groups";
import { fetchAll } from "./lib/data";
import { calculateStandings as leagueStandings } from "./lib/competition";
import { useModal } from "./lib/useModal";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { GitBranch, RefreshCw, Trophy, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

type Championship = {
  id: string;
  owner_id: string;
  name: string;
  format: "Pontos corridos" | "Mata-mata" | "Grupos + mata-mata";
};
type Team = {
  group_name?: string | null;
  id: string;
  championship_id: string;
  name: string;
  short_name: string | null;
};
type Match = {
  id: string;
  championship_id: string;
  home_team_id: string;
  away_team_id: string;
  round: number;
  status: string;
  home_score: number | null;
  away_score: number | null;
  bracket_stage: string | null;
  bracket_position: number | null;
  penalty_home_score: number | null;
  penalty_away_score: number | null;
};
type Standing = {
  id: string;
  name: string;
  pts: number;
  wins: number;
  sg: number;
  gf: number;
};

export default function KnockoutCenter({
  championshipId,
  onClose,
}: {
  championshipId: string;
  onClose: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null),
    [open, setOpen] = useState(true),
    [championships, setChampionships] = useState<Championship[]>([]),
    [selectedId, setSelectedId] = useState(championshipId),
    [teams, setTeams] = useState<Team[]>([]),
    [matches, setMatches] = useState<Match[]>([]),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  const modalRef = useModal(onClose, !!session);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session) void load();
  }, [session?.user.id]);
  async function load(preferred?: string) {
    if (!session?.user.id) return;
    setBusy(true);
    setFeedback("");
    try {
      const [cs, ts, ms] = await Promise.all([
        fetchAll(() =>
          supabase
            .from("championships")
            .select("id,owner_id,name,format")
            .eq("id", championshipId)
            .neq("format", "Pontos corridos")
            .order("id"),
        ),
        fetchAll(() =>
          supabase
            .from("teams")
            .select("*")
            .eq("championship_id", championshipId)
            .order("name")
            .order("id"),
        ),
        fetchAll(() =>
          supabase
            .from("matches")
            .select("*")
            .eq("championship_id", championshipId)
            .order("round")
            .order("bracket_position")
            .order("id"),
        ),
      ]);
      setChampionships(cs as Championship[]);
      setSelectedId(cs[0]?.id || "");
      setTeams(ts as Team[]);
      setMatches(ms as Match[]);
    } catch (e) {
      setFeedback((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function show() {
    setOpen(true);
    await load();
  }
  const championship = championships.find((c) => c.id === selectedId) || null,
    isOwner = !!championship && championship.owner_id === session?.user.id,
    selectedTeams = useMemo(
      () => teams.filter((t) => t.championship_id === selectedId),
      [teams, selectedId],
    ),
    selectedMatches = useMemo(
      () => matches.filter((m) => m.championship_id === selectedId),
      [matches, selectedId],
    ),
    bracketMatches = useMemo(
      () => selectedMatches.filter((m) => m.bracket_stage),
      [selectedMatches],
    ),
    standings = useMemo(
      () =>
        calculateStandings(
          selectedTeams,
          selectedMatches.filter((m) => !m.bracket_stage),
        ),
      [selectedTeams, selectedMatches],
    );
  async function generate() {
    if (!championship || !isOwner) return;
    setFeedback("");
    if (bracketMatches.length) {
      setFeedback("A chave já foi criada para este campeonato.");
      return;
    }
    if (busy) return;
    if (hasGroups(selectedTeams)) {
      setBusy(true);
      try {
        const { error } = await supabase.rpc("generate_group_knockout", {
          p_championship: championship.id,
        });
        if (error) throw error;
        await load(championship.id);
      } catch (e) {
        setFeedback((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    let seeded: Team[] = [];
    if (championship.format === "Grupos + mata-mata") {
      const league = selectedMatches.filter(
        (m) => !m.bracket_stage && m.status !== "cancelado",
      );
      if (!league.length || league.some((m) => m.status !== "finalizado"))
        return setFeedback(
          "Finalize todas as partidas da fase classificatória antes de gerar a chave.",
        );
      const size = largestPowerOfTwo(Math.min(16, standings.length));
      if (size < 2) {
        setFeedback(
          "Finalize partidas suficientes da fase de grupos antes de gerar o mata-mata.",
        );
        return;
      }
      const ids = standings.slice(0, size).map((s) => s.id);
      seeded = ids
        .map((id) => selectedTeams.find((t) => t.id === id)!)
        .filter(Boolean);
    } else {
      if (
        !isPowerOfTwo(selectedTeams.length) ||
        selectedTeams.length < 2 ||
        selectedTeams.length > 64
      ) {
        setFeedback(
          "No formato Mata-mata, cadastre 2, 4, 8, 16, 32 ou 64 times antes de gerar a chave.",
        );
        return;
      }
      seeded = [...selectedTeams];
    }
    const size = seeded.length,
      stage = stageName(size),
      pairs: Array<{ home: string; away: string; position: number }> = [];
    for (let i = 0; i < size / 2; i++)
      pairs.push({
        home: seeded[i].id,
        away: seeded[size - 1 - i].id,
        position: i + 1,
      });
    const { error } = await supabase.from("matches").insert(
      pairs.map((p) => ({
        championship_id: championship.id,
        home_team_id: p.home,
        away_team_id: p.away,
        round: 1,
        status: "agendado",
        bracket_stage: stage,
        bracket_position: p.position,
      })),
    );
    if (error) setFeedback(error.message);
    else {
      setFeedback("Chave eliminatória criada.");
      await load(championship.id);
    }
  }
  async function saveResult(
    match: Match,
    home: number,
    away: number,
    ph: number | null,
    pa: number | null,
  ) {
    if (!isOwner || busy) return;
    setBusy(true);
    setFeedback("");
    try {
      const { error } = await supabase.rpc("save_knockout_result", {
        p_match: match.id,
        p_home: home,
        p_away: away,
        p_penalty_home: ph,
        p_penalty_away: pa,
      });
      if (error) throw error;
      await load(selectedId);
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (
      !isOwner ||
      !championship ||
      !confirm("Apagar toda a chave eliminatória e seus resultados?")
    )
      return;
    const { error } = await supabase.rpc("reset_knockout", {
      p_championship: championship.id,
    });
    if (error) setFeedback(error.message);
    else {
      setFeedback("Chave removida.");
      await load(selectedId);
    }
  }
  const stages = useMemo(() => orderedStages(bracketMatches), [bracketMatches]),
    champion = useMemo(() => {
      const final = bracketMatches.find(
        (m) => m.bracket_stage === "Final" && m.status === "finalizado",
      );
      return final ? teamName(winnerId(final), selectedTeams) : "";
    }, [bracketMatches, selectedTeams]);
  if (!session) return null;
  return (
    <>
      {open && (
        <div className="knockout-backdrop" onClick={() => onClose()}>
          <section
            className="knockout-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">CHAVE ELIMINATÓRIA</p>
                <h2>Mata-mata</h2>
              </div>
              <div className="knockout-head-actions">
                <button className="icon-btn" onClick={() => void load()}>
                  <RefreshCw size={17} />
                </button>
                <button
                  aria-label="Fechar"
                  className="icon-btn"
                  onClick={() => onClose()}
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            {feedback && <div className="notice">{feedback}</div>}
            {busy ? (
              <p>Carregando…</p>
            ) : championships.length === 0 ? (
              <p className="muted">
                Crie um campeonato no formato Mata-mata ou Grupos + mata-mata.
              </p>
            ) : (
              <>
                <div className="knockout-toolbar">
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {championships.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name} · {c.format}
                      </option>
                    ))}
                  </select>
                  {isOwner && bracketMatches.length === 0 && (
                    <button
                      className="btn primary"
                      onClick={() => void generate()}
                    >
                      Gerar chave
                    </button>
                  )}
                  {isOwner && bracketMatches.length > 0 && (
                    <button
                      className="btn secondary"
                      onClick={() => void reset()}
                    >
                      Refazer chave
                    </button>
                  )}
                </div>
                {champion && (
                  <div className="champion-banner">
                    <Trophy size={28} />
                    <span>
                      <small>CAMPEÃO</small>
                      <strong>{champion}</strong>
                    </span>
                  </div>
                )}
                {bracketMatches.length === 0 ? (
                  <div className="knockout-empty">
                    <GitBranch size={34} />
                    <h3>Chave ainda não criada</h3>
                    <p>
                      {championship?.format === "Grupos + mata-mata"
                        ? hasGroups(selectedTeams)
                          ? "Avançam os dois primeiros de cada grupo, após todos os confrontos serem finalizados."
                          : "Este campeonato usa a classificação única anterior. Configure grupos na aba Classificação antes de cadastrar partidas em um novo campeonato."
                        : "Os times serão pareados pelo posicionamento da lista."}
                    </p>
                  </div>
                ) : (
                  <div className="bracket-board">
                    {stages.map((stage) => (
                      <div className="bracket-column" key={stage}>
                        <h3>{stage}</h3>
                        {bracketMatches
                          .filter((m) => m.bracket_stage === stage)
                          .sort(
                            (a, b) =>
                              (a.bracket_position || 0) -
                              (b.bracket_position || 0),
                          )
                          .map((m) => (
                            <KnockoutMatch
                              key={m.id}
                              match={m}
                              teams={selectedTeams}
                              editable={isOwner}
                              onSave={saveResult}
                            />
                          ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function KnockoutMatch({
  match,
  teams,
  editable,
  onSave,
}: {
  match: Match;
  teams: Team[];
  editable: boolean;
  onSave: (
    m: Match,
    h: number,
    a: number,
    ph: number | null,
    pa: number | null,
  ) => Promise<void>;
}) {
  const [h, setH] = useState(String(match.home_score ?? "")),
    [a, setA] = useState(String(match.away_score ?? "")),
    [ph, setPh] = useState(String(match.penalty_home_score ?? "")),
    [pa, setPa] = useState(String(match.penalty_away_score ?? ""));
  const tied = h !== "" && a !== "" && Number(h) === Number(a);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await onSave(
      match,
      Number(h),
      Number(a),
      tied && ph !== "" ? Number(ph) : null,
      tied && pa !== "" ? Number(pa) : null,
    );
  }
  return (
    <form className="bracket-match" onSubmit={submit}>
      <div>
        <span>{teamName(match.home_team_id, teams)}</span>
        {editable ? (
          <input
            type="number"
            min="0"
            value={h}
            onChange={(e) => setH(e.target.value)}
            required
          />
        ) : (
          <b>{match.home_score ?? "—"}</b>
        )}
      </div>
      <div>
        <span>{teamName(match.away_team_id, teams)}</span>
        {editable ? (
          <input
            type="number"
            min="0"
            value={a}
            onChange={(e) => setA(e.target.value)}
            required
          />
        ) : (
          <b>{match.away_score ?? "—"}</b>
        )}
      </div>
      {editable && tied && (
        <div className="penalty-row">
          <small>Pênaltis</small>
          <input
            type="number"
            min="0"
            value={ph}
            onChange={(e) => setPh(e.target.value)}
            placeholder="0"
            required
          />
          <span>×</span>
          <input
            type="number"
            min="0"
            value={pa}
            onChange={(e) => setPa(e.target.value)}
            placeholder="0"
            required
          />
        </div>
      )}
      {editable && (
        <button className="btn secondary small">
          {match.status === "finalizado" ? "Atualizar" : "Salvar resultado"}
        </button>
      )}
    </form>
  );
}
function teamName(id: string | null, teams: Team[]) {
  return teams.find((t) => t.id === id)?.name || "A definir";
}
function winnerId(m: Match) {
  if (m.home_score === null || m.away_score === null) return null;
  if (m.home_score > m.away_score) return m.home_team_id;
  if (m.away_score > m.home_score) return m.away_team_id;
  if ((m.penalty_home_score ?? -1) > (m.penalty_away_score ?? -1))
    return m.home_team_id;
  if ((m.penalty_away_score ?? -1) > (m.penalty_home_score ?? -1))
    return m.away_team_id;
  return null;
}
function stageName(teamCount: number) {
  if (teamCount >= 64) return "Fase de 64";
  if (teamCount === 32) return "16-avos";
  if (teamCount === 16) return "Oitavas";
  if (teamCount === 8) return "Quartas";
  if (teamCount === 4) return "Semifinal";
  return "Final";
}
function stageOrder(s: string) {
  return [
    "Fase de 64",
    "16-avos",
    "Oitavas",
    "Quartas",
    "Semifinal",
    "Final",
  ].indexOf(s);
}
function orderedStages(ms: Match[]) {
  return [
    ...new Set(ms.map((m) => m.bracket_stage).filter(Boolean) as string[]),
  ].sort((a, b) => stageOrder(a) - stageOrder(b));
}
function isPowerOfTwo(n: number) {
  return n > 0 && (n & (n - 1)) === 0;
}
function largestPowerOfTwo(n: number) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}
function calculateStandings(ts: Team[], ms: Match[]): Standing[] {
  return leagueStandings(ts, ms).map((r) => ({
    id: r.team.id,
    name: r.team.name,
    pts: r.points,
    wins: r.wins,
    sg: r.goalDiff,
    gf: r.goalsFor,
  }));
}

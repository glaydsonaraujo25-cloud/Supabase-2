import PrivateChampionshipResults from "./PrivateChampionshipResults";
import PrivateMatchDetails from "./PrivateMatchDetails";
import GroupManager from "./GroupManager";
import GroupStandings from "./GroupStandings";
import { hasGroups } from "./lib/groups";
import StandingsTable from "./StandingsTable";
import type { FormResult } from "./lib/competition";
import ChampionshipAgenda from "./ChampionshipAgenda";
import MatchSchedule from "./MatchSchedule";
import MatchFilters from "./MatchFilters";
import { matchStatus } from "./lib/competition";
import AuthScreen from "./AuthScreen";
import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  Copy,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Medal,
  Plus,
  RefreshCw,
  Swords,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import ParticipantAdminCenter from "./ParticipantAdminCenter";
import SharingCenter from "./SharingCenter";
import StatisticsCenter from "./StatisticsCenter";
import KnockoutCenter from "./KnockoutCenter";
import EditDialog from "./EditDialog";
import { fetchAll } from "./lib/data";
import {
  isLeagueMatch,
  calculateStandings,
  validScore,
} from "./lib/competition";
import { siteUrl, supabase } from "./lib/supabase";

type Championship = {
  id: string;
  owner_id: string;
  name: string;
  sport: string;
  format: "Pontos corridos" | "Mata-mata" | "Grupos + mata-mata";
  status: "rascunho" | "aberto" | "em_andamento" | "finalizado";
  start_date: string | null;
  end_date: string | null;
  max_teams: number;
  invite_code: string;
  created_at: string;
  updated_at: string;
};
type Team = {
  group_name?: string | null;
  id: string;
  championship_id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  manager_user_id: string | null;
  created_at: string;
};
type Player = {
  id: string;
  team_id: string;
  name: string;
  shirt_number: number | null;
  position: string | null;
  created_at: string;
};
type Match = {
  venue?: string | null;
  duration_minutes?: number | null;
  bracket_stage: string | null;
  penalty_home_score: number | null;
  penalty_away_score: number | null;
  id: string;
  championship_id: string;
  home_team_id: string;
  away_team_id: string;
  round: number;
  scheduled_at: string | null;
  status: "agendado" | "em_andamento" | "finalizado" | "cancelado";
  home_score: number | null;
  away_score: number | null;
  created_at: string;
};
type Member = {
  id: string;
  championship_id: string;
  user_id: string;
  role: "participant" | "organizer";
  joined_at: string;
};
type Profile = { id: string; full_name: string; email?: string | null };
type Tab = "inicio" | "campeonatos" | "times" | "partidas" | "classificacao";
type Standing = {
  team: Team;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  percentage: number | null;
  form: FormResult[];
};

const nav = [
  ["inicio", "Visão geral", LayoutDashboard],
  ["campeonatos", "Campeonatos", Trophy],
  ["times", "Times e jogadores", Users],
  ["partidas", "Partidas", Swords],
  ["classificacao", "Classificação", Medal],
] as const;

export default function ChampionshipDashboard() {
  const [tool, setTool] = useState("");
  const loadVersion = useRef(0);
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [championships, setChampionships] = useState<Championship[]>([]),
    [teams, setTeams] = useState<Team[]>([]),
    [players, setPlayers] = useState<Player[]>([]),
    [matches, setMatches] = useState<Match[]>([]),
    [members, setMembers] = useState<Member[]>([]),
    [selectedId, setSelectedId] = useState(""),
    [tab, setTab] = useState<Tab>("inicio"),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [recovery, setRecovery] = useState(
      new URLSearchParams(location.search).get("reset") === "1",
    );
  useEffect(() => {
    const p = new URLSearchParams(location.search),
      err = p.get("error_description");
    if (err) setNotice(err);
    else if (p.get("confirmed") === "1")
      setNotice("E-mail confirmado com sucesso. Você já pode entrar.");
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (!next) {
        loadVersion.current++;
        setTool("");
        setSelectedId("");
        setProfile(null);
        setChampionships([]);
        setTeams([]);
        setPlayers([]);
        setMatches([]);
        setMembers([]);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session?.user.id && !recovery) void loadData();
  }, [session?.user.id, recovery]);
  async function loadData(preferred?: string) {
    if (!session?.user.id) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setNotice("");
    try {
      const [p, cs] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,email")
          .eq("id", session.user.id)
          .maybeSingle()
          .throwOnError(),
        fetchAll(() =>
          supabase
            .from("championships")
            .select("*")
            .order("created_at", { ascending: false })
            .order("id"),
        ),
      ]);
      if (version !== loadVersion.current) return;
      const list = cs as Championship[],
        wanted = preferred || selectedId;
      const next =
        wanted && list.some((x) => x.id === wanted)
          ? wanted
          : list[0]?.id || "";
      setProfile(p.data as Profile);
      setChampionships(list);
      setSelectedId(next);
      if (!next) {
        setTeams([]);
        setPlayers([]);
        setMatches([]);
        setMembers([]);
        return;
      }
      const [ts, ms, mb] = await Promise.all([
        fetchAll(() =>
          supabase
            .from("teams")
            .select("*")
            .eq("championship_id", next)
            .order("name")
            .order("id"),
        ),
        fetchAll(() =>
          supabase
            .from("matches")
            .select("*")
            .eq("championship_id", next)
            .order("round")
            .order("id"),
        ),
        fetchAll(() =>
          supabase
            .from("championship_members")
            .select("*")
            .eq("championship_id", next)
            .order("id"),
        ),
      ]);
      const ids = ts.map((t) => t.id);
      const ps = ids.length
        ? await fetchAll(() =>
            supabase
              .from("players")
              .select("*")
              .in("team_id", ids)
              .order("name")
              .order("id"),
          )
        : [];
      if (version !== loadVersion.current) return;
      setTeams(ts as Team[]);
      setMatches(ms as Match[]);
      setMembers(mb as Member[]);
      setPlayers(ps as Player[]);
    } catch (error) {
      if (version === loadVersion.current)
        setNotice(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os dados. Tente atualizar.",
        );
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }
  function selectChampionship(id: string) {
    setSelectedId(id);
    void loadData(id);
  }

  const uid = session?.user.id || "",
    selected = championships.find((x) => x.id === selectedId) || null,
    isOwner = !!selected && selected.owner_id === uid,
    selectedTeams = useMemo(
      () => teams.filter((x) => x.championship_id === selectedId),
      [teams, selectedId],
    ),
    teamIds = useMemo(
      () => new Set(selectedTeams.map((x) => x.id)),
      [selectedTeams],
    ),
    selectedPlayers = useMemo(
      () => players.filter((x) => teamIds.has(x.team_id)),
      [players, teamIds],
    ),
    selectedMatches = useMemo(
      () => matches.filter((x) => x.championship_id === selectedId),
      [matches, selectedId],
    ),
    standings = useMemo(
      () =>
        calculateStandings(
          selectedTeams,
          selectedMatches.filter(isLeagueMatch),
        ),
      [selectedTeams, selectedMatches],
    );
  if (recovery && session)
    return (
      <ResetPassword
        onDone={() => {
          setRecovery(false);
          history.replaceState({}, "", "/");
        }}
      />
    );
  if (loading && !session)
    return <div className="center-screen">Carregando…</div>;
  if (!session) return <AuthScreen initialMessage={notice} />;
  return (
    <div className="cm-shell">
      <aside className="cm-sidebar">
        <div className="cm-brand">
          <div className="cm-brand-icon">
            <Trophy size={22} />
          </div>
          <div>
            <strong>Bracketly</strong>
            <span>Gestor de campeonatos</span>
          </div>
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? "cm-nav active" : "cm-nav"}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          {selected && (
            <>
              <span className="cm-nav-section">FERRAMENTAS</span>
              {[
                ["participantes", "Participantes"],
                ["estatisticas", "Estatísticas"],
                ["compartilhar", "Compartilhar"],
                ["mata-mata", "Mata-mata"],
              ]
                .filter(
                  ([id]) =>
                    (isOwner ||
                      !["participantes", "compartilhar"].includes(id)) &&
                    (id !== "mata-mata" ||
                      selected.format !== "Pontos corridos"),
                )
                .map(([id, label]) => (
                  <button
                    className="cm-nav"
                    key={id}
                    onClick={() => setTool(id)}
                  >
                    {label}
                  </button>
                ))}
            </>
          )}
        </nav>
        <div className="cm-account">
          <div>
            <CircleUserRound size={20} />
            <span>
              <strong>{profile?.full_name || session.user.email}</strong>
              <small>{session.user.email}</small>
            </span>
          </div>
          <button onClick={() => void supabase.auth.signOut()}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>
      <main className="cm-main">
        <header className="cm-topbar">
          <div>
            <p>{isOwner ? "PAINEL DO ORGANIZADOR" : "ÁREA DO PARTICIPANTE"}</p>
            <h1>{nav.find((x) => x[0] === tab)?.[1]}</h1>
          </div>
          <div className="cm-top-actions">
            {championships.length > 0 && (
              <select
                value={selectedId}
                onChange={(e) => selectChampionship(e.target.value)}
              >
                {championships.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.owner_id === uid ? "★ " : ""}
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <button className="btn secondary" onClick={() => void loadData()}>
              <RefreshCw size={16} /> Atualizar
            </button>
          </div>
        </header>
        {notice && <div className="notice">{notice}</div>}
        {loading ? (
          <div className="loading-card">Atualizando dados…</div>
        ) : (
          <>
            {tab === "inicio" && (
              <Overview
                championship={selected}
                teams={selectedTeams}
                players={selectedPlayers}
                matches={selectedMatches}
                standings={standings}
                isOwner={isOwner}
                go={setTab}
              />
            )}{" "}
            {tab === "campeonatos" && (
              <Championships
                championships={championships}
                members={members}
                selectedId={selectedId}
                userId={uid}
                onSelect={selectChampionship}
                reload={loadData}
              />
            )}{" "}
            {tab === "times" && (
              <Teams
                championship={selected}
                teams={selectedTeams}
                players={players}
                userId={uid}
                isOwner={isOwner}
                reload={() => loadData(selectedId)}
                go={setTab}
              />
            )}{" "}
            {tab === "partidas" && (
              <Matches
                key={selectedId}
                championship={selected}
                teams={selectedTeams}
                onKnockout={() => setTool("mata-mata")}
                allMatches={selectedMatches}
                matches={selectedMatches.filter(isLeagueMatch)}
                isOwner={isOwner}
                reload={() => loadData(selectedId)}
              />
            )}{" "}
            {tab === "classificacao" &&
              (selected?.format === "Mata-mata" ? (
                <div className="panel">
                  <h3>Classificação eliminatória</h3>
                  <p>Acompanhe os classificados e o campeão na chave.</p>
                  <button
                    className="btn primary"
                    onClick={() => setTool("mata-mata")}
                  >
                    Abrir mata-mata
                  </button>
                </div>
              ) : (
                <>
                  {selected?.format === "Grupos + mata-mata" && isOwner && (
                    <GroupManager
                      key={selectedId}
                      championshipId={selectedId}
                      teams={selectedTeams}
                      locked={selectedMatches.length > 0}
                      reload={() => loadData(selectedId)}
                    />
                  )}
                  {hasGroups(selectedTeams) ? (
                    <GroupStandings
                      teams={selectedTeams}
                      matches={selectedMatches}
                    />
                  ) : (
                    <Standings championship={selected} rows={standings} />
                  )}
                </>
              ))}
          </>
        )}
      </main>
      {tool === "participantes" && (
        <ParticipantAdminCenter
          championshipId={selectedId}
          onClose={() => {
            setTool("");
            void loadData(selectedId);
          }}
        />
      )}
      {tool === "compartilhar" && (
        <SharingCenter
          championshipId={selectedId}
          onClose={() => setTool("")}
        />
      )}
      {tool === "estatisticas" && (
        <StatisticsCenter
          championshipId={selectedId}
          onClose={() => {
            setTool("");
            void loadData(selectedId);
          }}
        />
      )}
      {tool === "mata-mata" && (
        <KnockoutCenter
          championshipId={selectedId}
          onClose={() => {
            setTool("");
            void loadData(selectedId);
          }}
        />
      )}
    </div>
  );
}

function ResetPassword({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState(""),
    [b, setB] = useState(""),
    [feedback, setFeedback] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (a !== b) return setFeedback("As senhas não coincidem.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: a });
    setBusy(false);
    if (error) setFeedback(error.message);
    else {
      await supabase.auth.signOut();
      onDone();
    }
  }
  return (
    <div className="center-screen">
      <form className="auth-form" onSubmit={submit}>
        <h2>Nova senha</h2>
        <label>
          Senha
          <input
            type="password"
            minLength={8}
            value={a}
            onChange={(e) => setA(e.target.value)}
            required
          />
        </label>
        <label>
          Confirmar senha
          <input
            type="password"
            minLength={8}
            value={b}
            onChange={(e) => setB(e.target.value)}
            required
          />
        </label>
        {feedback && <div className="notice">{feedback}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}

function Overview({
  championship,
  teams,
  players,
  matches,
  standings,
  isOwner,
  go,
}: {
  championship: Championship | null;
  teams: Team[];
  players: Player[];
  matches: Match[];
  standings: Standing[];
  isOwner: boolean;
  go: (t: Tab) => void;
}) {
  if (!championship)
    return (
      <Empty
        title="Comece criando ou entrando em um campeonato"
        text="Crie sua competição ou use um código de convite para participar."
        action={
          <button className="btn primary" onClick={() => go("campeonatos")}>
            <Plus size={16} /> Campeonatos
          </button>
        }
      />
    );
  return (
    <div className="stack">
      <section className="hero">
        <div>
          <span className={`status status-${championship.status}`}>
            {statusLabel(championship.status)}
          </span>
          <h2>{championship.name}</h2>
          <p>
            {championship.sport} · {championship.format} ·{" "}
            {isOwner ? "Você organiza" : "Você participa"}
          </p>
        </div>
        <Trophy size={70} />
      </section>
      <PrivateChampionshipResults
        key={`results-${championship.id}`}
        championship={championship}
        teams={teams}
        matches={matches}
        players={players}
      />
      <section className="stats">
        <Stat
          label="Times"
          value={teams.length}
          text={`de ${championship.max_teams} vagas`}
        />
        <Stat label="Jogadores" value={players.length} text="cadastrados" />
        <Stat
          label="Partidas"
          value={matches.length}
          text={`${matches.filter((m) => m.status === "finalizado").length} finalizadas`}
        />
        <Stat
          label={hasGroups(teams) ? "Grupos" : "Líder"}
          value={
            hasGroups(teams)
              ? new Set(teams.map((t) => t.group_name).filter(Boolean)).size
              : standings[0]?.team.short_name || standings[0]?.team.name || "—"
          }
          text={
            hasGroups(teams)
              ? "2 classificados por grupo"
              : standings[0]
                ? `${standings[0].points} pontos`
                : "sem resultados"
          }
        />
      </section>
      <ChampionshipAgenda
        key={championship.id}
        championship={championship}
        teams={teams}
        matches={matches}
      />
      <section className="grid-two">
        <div className="panel">
          <p className="eyebrow">SEU PAPEL</p>
          <h3>{isOwner ? "Organizador" : "Participante"}</h3>
          <p className="muted">
            {isOwner
              ? "Você controla configurações, partidas, resultados e todos os times."
              : "Você pode criar e gerenciar seu próprio time. Partidas e resultados são controlados pelo organizador."}
          </p>
        </div>
        <div className="panel">
          <p className="eyebrow">CLASSIFICAÇÃO</p>
          <h3>{hasGroups(teams) ? "Classificação por grupo" : "Top 5"}</h3>
          {hasGroups(teams) ? (
            <button
              className="btn secondary"
              onClick={() => go("classificacao")}
            >
              Ver grupos e classificados
            </button>
          ) : standings.length ? (
            <div className="ranking-mini">
              {standings.slice(0, 5).map((r, i) => (
                <div key={r.team.id}>
                  <span>{i + 1}</span>
                  <strong>{r.team.name}</strong>
                  <b>{r.points} pts</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              A tabela aparecerá após os times serem cadastrados.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Championships({
  championships,
  members,
  selectedId,
  userId,
  onSelect,
  reload,
}: {
  championships: Championship[];
  members: Member[];
  selectedId: string;
  userId: string;
  onSelect: (id: string) => void;
  reload: (id?: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Championship | null>(null);
  const [show, setShow] = useState(false),
    [name, setName] = useState(""),
    [sport, setSport] = useState("Futebol"),
    [format, setFormat] = useState<Championship["format"]>("Pontos corridos"),
    [start, setStart] = useState(""),
    [max, setMax] = useState(8),
    [code, setCode] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  async function edit(values: Record<string, string>) {
    if (!editing) return;
    const { error } = await supabase
      .from("championships")
      .update({
        name: values.name.trim(),
        sport: values.sport.trim(),
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        max_teams: Number(values.max_teams),
      })
      .eq("id", editing.id);
    if (error) throw error;
    setEditing(null);
    await reload(editing.id);
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from("championships")
      .insert({
        owner_id: userId,
        name: name.trim(),
        sport: sport.trim(),
        format,
        start_date: start || null,
        max_teams: max,
      })
      .select("id")
      .single();
    if (error) return setFeedback(error.message);
    setName("");
    setShow(false);
    await reload(data.id);
    onSelect(data.id);
  }
  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback("");
    const { data, error } = await supabase.rpc("join_championship_by_code", {
      p_code: code.trim(),
    });
    if (error) setFeedback(error.message);
    else {
      setCode("");
      await reload(data as string);
      onSelect(data as string);
      setFeedback("Você entrou no campeonato com sucesso.");
    }
    setBusy(false);
  }
  async function remove(c: Championship) {
    if (!confirm(`Excluir “${c.name}” e todos os dados vinculados?`)) return;
    const { error } = await supabase
      .from("championships")
      .delete()
      .eq("id", c.id);
    if (error) setFeedback(error.message);
    else await reload();
  }
  async function changeStatus(c: Championship, s: Championship["status"]) {
    const { error } = await supabase
      .from("championships")
      .update({ status: s, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) setFeedback(error.message);
    else await reload(c.id);
  }
  async function leave(c: Championship) {
    const { error } = await supabase
      .from("championship_members")
      .delete()
      .eq("championship_id", c.id)
      .eq("user_id", userId);
    if (error) setFeedback(error.message);
    else await reload();
  }
  return (
    <div className="stack">
      {editing && (
        <EditDialog
          title="Editar campeonato"
          values={{
            name: editing.name,
            sport: editing.sport,
            start_date: editing.start_date || "",
            end_date: editing.end_date || "",
            max_teams: String(editing.max_teams),
          }}
          fields={[
            { name: "name", label: "Nome", required: true },
            { name: "sport", label: "Modalidade", required: true },
            { name: "start_date", label: "Início", type: "date" },
            { name: "end_date", label: "Término", type: "date" },
            {
              name: "max_teams",
              label: "Máximo de times",
              type: "number",
              min: 2,
              max: 64,
              required: true,
            },
          ]}
          onSave={edit}
          onClose={() => setEditing(null)}
        />
      )}
      <section className="panel join-panel">
        <div>
          <p className="eyebrow">PARTICIPAR</p>
          <h3>Entrar com código</h3>
          <p className="muted">Peça o código ao organizador do campeonato.</p>
        </div>
        <form className="join-form" onSubmit={join}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="EX.: A1B2C3D4"
            required
          />
          <button className="btn secondary" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </section>
      <div className="page-actions">
        <p className="muted">Os campeonatos com ★ foram criados por você.</p>
        <button className="btn primary" onClick={() => setShow((v) => !v)}>
          <Plus size={16} /> Novo campeonato
        </button>
      </div>
      {show && (
        <form className="panel form-grid" onSubmit={create}>
          <label className="span2">
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={3}
              required
            />
          </label>
          <label>
            Modalidade
            <input
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              required
            />
          </label>
          <label>
            Formato
            <select
              value={format}
              onChange={(e) =>
                setFormat(e.target.value as Championship["format"])
              }
            >
              <option>Pontos corridos</option>
              <option>Mata-mata</option>
              <option>Grupos + mata-mata</option>
            </select>
          </label>
          <label>
            Data de início
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Máximo de times
            <input
              type="number"
              min={2}
              max={64}
              value={max}
              onChange={(e) => setMax(Number(e.target.value))}
            />
          </label>
          <div className="form-actions span2">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setShow(false)}
            >
              Cancelar
            </button>
            <button className="btn primary">Criar campeonato</button>
          </div>
        </form>
      )}
      {feedback && <div className="notice">{feedback}</div>}
      <div className="cards">
        {championships.map((c) => {
          const own = c.owner_id === userId;
          return (
            <article
              className={
                c.id === selectedId ? "champ-card selected" : "champ-card"
              }
              key={c.id}
              onClick={() => onSelect(c.id)}
            >
              <div>
                <span className={`status status-${c.status}`}>
                  {statusLabel(c.status)}
                </span>
                <h3>
                  {own ? "★ " : ""}
                  {c.name}
                </h3>
                <p>
                  {c.sport} · {c.format}
                </p>
                {own && (
                  <button
                    className="invite-code"
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigator.clipboard.writeText(c.invite_code);
                    }}
                    title="Copiar código"
                  >
                    <Copy size={14} /> Código: <b>{c.invite_code}</b>
                  </button>
                )}
              </div>
              <div className="card-actions">
                {own ? (
                  <>
                    <button
                      className="btn secondary small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(c);
                      }}
                    >
                      Editar
                    </button>
                    <select
                      value={c.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        void changeStatus(
                          c,
                          e.target.value as Championship["status"],
                        )
                      }
                    >
                      <option value="rascunho">Rascunho</option>
                      <option value="aberto">Inscrições abertas</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="finalizado">Finalizado</option>
                    </select>
                    <button
                      className="icon-btn danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(c);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <button
                    className="btn secondary small"
                    onClick={(e) => {
                      e.stopPropagation();
                      void leave(c);
                    }}
                  >
                    Sair
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Teams({
  championship,
  teams,
  players,
  userId,
  isOwner,
  reload,
  go,
}: {
  championship: Championship | null;
  teams: Team[];
  players: Player[];
  userId: string;
  isOwner: boolean;
  reload: () => Promise<void>;
  go: (t: Tab) => void;
}) {
  const [editing, setEditing] = useState<{
    kind: "team" | "player";
    item: Team | Player;
  } | null>(null);
  const [name, setName] = useState(""),
    [short, setShort] = useState(""),
    [city, setCity] = useState(""),
    [open, setOpen] = useState(""),
    [pname, setPname] = useState(""),
    [shirt, setShirt] = useState(""),
    [position, setPosition] = useState(""),
    [feedback, setFeedback] = useState("");
  if (!championship)
    return (
      <Empty
        title="Selecione um campeonato"
        text="Escolha um campeonato antes de cadastrar times."
        action={
          <button className="btn primary" onClick={() => go("campeonatos")}>
            Ir para campeonatos
          </button>
        }
      />
    );
  const myTeam = teams.find((t) => t.manager_user_id === userId),
    canCreate = isOwner || !myTeam;
  async function edit(values: Record<string, string>) {
    if (!editing) return;
    const data =
      editing.kind === "team"
        ? {
            name: values.name.trim(),
            short_name: values.short_name.trim().toUpperCase() || null,
            city: values.city.trim() || null,
          }
        : {
            name: values.name.trim(),
            shirt_number: values.shirt_number
              ? Number(values.shirt_number)
              : null,
            position: values.position.trim() || null,
          };
    const { error } = await supabase
      .from(editing.kind === "team" ? "teams" : "players")
      .update(data)
      .eq("id", editing.item.id);
    if (error) throw error;
    setEditing(null);
    await reload();
  }
  async function addTeam(e: FormEvent) {
    e.preventDefault();
    if (teams.length >= championship.max_teams)
      return setFeedback("O limite de times foi atingido.");
    if (teams.some((t) => t.name.toLowerCase() === name.trim().toLowerCase()))
      return setFeedback("Já existe um time com esse nome.");
    const { error } = await supabase.from("teams").insert({
      championship_id: championship.id,
      name: name.trim(),
      short_name: short.trim().toUpperCase() || null,
      city: city.trim() || null,
      manager_user_id: isOwner ? null : userId,
    });
    if (error) setFeedback(error.message);
    else {
      setName("");
      setShort("");
      setCity("");
      await reload();
    }
  }
  async function addPlayer(e: FormEvent, teamId: string) {
    e.preventDefault();
    const roster = players.filter((p) => p.team_id === teamId);
    if (shirt && roster.some((p) => p.shirt_number === Number(shirt)))
      return setFeedback("Esse número de camisa já está em uso neste time.");
    const { error } = await supabase.from("players").insert({
      team_id: teamId,
      name: pname.trim(),
      shirt_number: shirt ? Number(shirt) : null,
      position: position.trim() || null,
    });
    if (error) setFeedback(error.message);
    else {
      setPname("");
      setShirt("");
      setPosition("");
      await reload();
    }
  }
  async function delTeam(id: string) {
    if (!confirm("Excluir este time e seus jogadores?")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) setFeedback(error.message);
    else await reload();
  }
  async function delPlayer(id: string) {
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) setFeedback(error.message);
    else await reload();
  }
  return (
    <div className="stack">
      {editing && (
        <EditDialog
          title={editing.kind === "team" ? "Editar time" : "Editar jogador"}
          values={
            editing.kind === "team"
              ? {
                  name: editing.item.name,
                  short_name: (editing.item as Team).short_name || "",
                  city: (editing.item as Team).city || "",
                }
              : {
                  name: editing.item.name,
                  shirt_number: String(
                    (editing.item as Player).shirt_number ?? "",
                  ),
                  position: (editing.item as Player).position || "",
                }
          }
          fields={
            editing.kind === "team"
              ? [
                  { name: "name", label: "Nome", required: true },
                  { name: "short_name", label: "Sigla" },
                  { name: "city", label: "Cidade" },
                ]
              : [
                  { name: "name", label: "Nome", required: true },
                  {
                    name: "shirt_number",
                    label: "Camisa",
                    type: "number",
                    min: 0,
                    max: 99,
                  },
                  { name: "position", label: "Posição" },
                ]
          }
          onSave={edit}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {canCreate && (
        <form className="panel team-form" onSubmit={addTeam}>
          <div>
            <p className="eyebrow">{isOwner ? "NOVO TIME" : "SEU TIME"}</p>
            <h3>
              {teams.length}/{championship.max_teams} cadastrados
            </h3>
          </div>
          <label>
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Sigla
            <input
              value={short}
              maxLength={5}
              onChange={(e) => setShort(e.target.value)}
              placeholder="ABC"
            />
          </label>
          <label>
            Cidade
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Opcional"
            />
          </label>
          <button className="btn primary">
            <Plus size={16} /> Adicionar
          </button>
        </form>
      )}
      {!isOwner && myTeam && (
        <div className="notice">
          Você gerencia o time <b>{myTeam.name}</b>. Os outros times são somente
          para consulta.
        </div>
      )}
      {feedback && <div className="notice">{feedback}</div>}
      <div className="team-list">
        {teams.map((t) => {
          const roster = players.filter((p) => p.team_id === t.id),
            expanded = open === t.id,
            canManage = isOwner || t.manager_user_id === userId;
          return (
            <article className="team-card" key={t.id}>
              <div className="team-summary">
                <button
                  className="team-main"
                  onClick={() => setOpen(expanded ? "" : t.id)}
                >
                  <span className="badge">
                    {t.short_name || initials(t.name)}
                  </span>
                  <span>
                    <strong>{t.name}</strong>
                    <small>
                      {t.city || "Cidade não informada"} · {roster.length}{" "}
                      jogadores
                      {t.manager_user_id === userId ? " · Seu time" : ""}
                    </small>
                  </span>
                </button>
                {canManage && (
                  <button
                    className="btn secondary small"
                    onClick={() => setEditing({ kind: "team", item: t })}
                  >
                    Editar
                  </button>
                )}
                {canManage && (
                  <button
                    aria-label="Excluir time"
                    className="icon-btn danger"
                    onClick={() => void delTeam(t.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              {expanded && (
                <div className="roster">
                  <div>
                    {roster.length === 0 ? (
                      <p className="muted">Nenhum jogador cadastrado.</p>
                    ) : (
                      roster.map((p) => (
                        <div className="player-row" key={p.id}>
                          <b>{p.shirt_number ?? "—"}</b>
                          <span>
                            <strong>{p.name}</strong>
                            <small>
                              {p.position || "Posição não informada"}
                            </small>
                          </span>
                          {canManage && (
                            <button
                              className="btn secondary small"
                              onClick={() =>
                                setEditing({ kind: "player", item: p })
                              }
                            >
                              Editar
                            </button>
                          )}
                          {canManage && (
                            <button
                              aria-label="Excluir jogador"
                              className="icon-btn danger"
                              onClick={() => void delPlayer(p.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {canManage && (
                    <form
                      className="player-form"
                      onSubmit={(e) => void addPlayer(e, t.id)}
                    >
                      <input
                        value={pname}
                        onChange={(e) => setPname(e.target.value)}
                        placeholder="Nome do jogador"
                        required
                      />
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={shirt}
                        onChange={(e) => setShirt(e.target.value)}
                        placeholder="Nº"
                      />
                      <input
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="Posição"
                      />
                      <button className="btn secondary">
                        <UserPlus size={16} /> Adicionar
                      </button>
                    </form>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Matches({
  allMatches,
  onKnockout,
  championship,
  teams,
  matches,
  isOwner,
  reload,
}: {
  allMatches: Match[];
  onKnockout: () => void;
  championship: Championship | null;
  teams: Team[];
  matches: Match[];
  isOwner: boolean;
  reload: () => Promise<void>;
}) {
  const [details, setDetails] = useState<Match | null>(null);
  const [editing, setEditing] = useState<Match | null>(null);
  const [teamFilter, setTeamFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState("");
  const [roundPage, setRoundPage] = useState(0);
  const [home, setHome] = useState(""),
    [away, setAway] = useState(""),
    [round, setRound] = useState(1),
    [date, setDate] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  if (!championship)
    return (
      <Empty
        title="Selecione um campeonato"
        text="Escolha um campeonato para ver as partidas."
      />
    );
  const teamName = (id: string) =>
    teams.find((t) => t.id === id)?.name || "Time removido";
  async function add(e: FormEvent) {
    e.preventDefault();
    if (championship.format === "Mata-mata")
      return setFeedback("Use Mata-mata no menu.");
    if (
      championship.format === "Grupos + mata-mata" &&
      !hasGroups(teams) &&
      !matches.length
    )
      return setFeedback(
        "Distribua os times em grupos na aba Classificação antes de criar partidas.",
      );
    if (home === away) return setFeedback("Selecione times diferentes.");
    const { error } = await supabase.from("matches").insert({
      championship_id: championship.id,
      home_team_id: home,
      away_team_id: away,
      round,
      scheduled_at: date ? new Date(date).toISOString() : null,
    });
    if (error) setFeedback(error.message);
    else {
      setHome("");
      setAway("");
      setDate("");
      await reload();
    }
  }
  async function generate() {
    if (
      championship.format === "Grupos + mata-mata" &&
      !hasGroups(teams) &&
      !matches.length
    )
      return setFeedback(
        "Distribua os times em grupos na aba Classificação antes de gerar rodadas.",
      );
    if (teams.length < 2) return setFeedback("Cadastre pelo menos 2 times.");
    if (championship.format === "Mata-mata")
      return setFeedback("Use Mata-mata no menu para gerar a chave.");
    if (matches.length)
      return setFeedback(
        "Já existem partidas. A geração automática não duplica a tabela.",
      );
    setBusy(true);
    if (hasGroups(teams)) {
      try {
        const { error } = await supabase.rpc("generate_group_matches", {
          p_championship: championship.id,
        });
        if (error) throw error;
        await reload();
      } catch (e) {
        setFeedback((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    const fixtures = roundRobin(teams.map((t) => t.id)).map((f) => ({
      championship_id: championship.id,
      home_team_id: f.home,
      away_team_id: f.away,
      round: f.round,
      status: "agendado",
    }));
    const { error } = await supabase.from("matches").insert(fixtures);
    if (error) setFeedback(error.message);
    else await reload();
    setBusy(false);
  }
  async function saveResult(id: string, a: string, b: string) {
    const hs = Number(a),
      as = Number(b);
    if (!validScore(a) || !validScore(b))
      return setFeedback("Informe placares válidos.");
    const { error } = await supabase
      .from("matches")
      .update({ home_score: hs, away_score: as, status: "finalizado" })
      .eq("id", id);
    if (error) setFeedback(error.message);
    else await reload();
  }
  async function del(id: string) {
    if (
      !confirm(
        "Excluir esta partida e seus registros? Essa ação não pode ser desfeita.",
      )
    )
      return;
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) setFeedback(error.message);
    else await reload();
  }
  const filtered = matches.filter(
    (m) =>
      (!teamFilter ||
        m.home_team_id === teamFilter ||
        m.away_team_id === teamFilter) &&
      (!statusFilter || m.status === statusFilter),
  );
  const grouped = Array.from(new Set(filtered.map((m) => m.round))).sort(
    (a, b) => a - b,
  );
  return (
    <div className="stack">
      {details && (
        <PrivateMatchDetails
          key={details.id}
          match={details}
          teams={teams}
          onClose={() => setDetails(null)}
        />
      )}
      {editing && (
        <MatchSchedule
          games={allMatches}
          teams={teams}
          match={editing}
          title={`${teamName(editing.home_team_id)} × ${teamName(editing.away_team_id)}`}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      <MatchFilters
        teams={teams}
        team={teamFilter}
        status={statusFilter}
        onTeam={(v) => {
          setTeamFilter(v);
          setRoundPage(0);
        }}
        onStatus={(v) => {
          setStatusFilter(v);
          setRoundPage(0);
        }}
        count={filtered.length}
      />
      {championship.format !== "Pontos corridos" && (
        <button className="btn secondary" onClick={onKnockout}>
          Abrir chave eliminatória
        </button>
      )}
      {isOwner ? (
        <>
          <div className="page-actions">
            <p className="muted">
              Crie jogos manualmente ou gere todos os confrontos.
            </p>
            <button
              className="btn primary"
              disabled={
                busy ||
                teams.length < 2 ||
                championship.format === "Mata-mata" ||
                matches.length > 0
              }
              onClick={() => void generate()}
            >
              <CalendarDays size={16} />{" "}
              {busy ? "Gerando…" : "Gerar tabela automática"}
            </button>
          </div>
          {championship.format !== "Mata-mata" && teams.length >= 2 && (
            <form className="panel match-form" onSubmit={add}>
              <label>
                Mandante
                <select
                  value={home}
                  onChange={(e) => setHome(e.target.value)}
                  required
                >
                  <option value="">Selecione</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Visitante
                <select
                  value={away}
                  onChange={(e) => setAway(e.target.value)}
                  required
                >
                  <option value="">Selecione</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Rodada
                <input
                  type="number"
                  min={1}
                  value={round}
                  onChange={(e) => setRound(Number(e.target.value))}
                />
              </label>
              <label>
                Data e hora
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <button className="btn secondary">
                <Plus size={16} /> Adicionar
              </button>
            </form>
          )}
        </>
      ) : (
        <div className="notice">
          Somente o organizador pode criar partidas e lançar resultados.
        </div>
      )}
      {feedback && <div className="notice">{feedback}</div>}
      {filtered.length === 0 ? (
        <Empty
          title={
            matches.length
              ? "Nenhuma partida com esses filtros"
              : "Nenhuma partida"
          }
          text={
            matches.length
              ? "Altere ou limpe os filtros para ver outros jogos."
              : "As partidas aparecerão aqui quando o organizador montar a tabela."
          }
        />
      ) : (
        <div className="rounds">
          {grouped.length > 5 && (
            <div className="page-actions">
              <button
                className="btn secondary"
                disabled={roundPage === 0}
                onClick={() => setRoundPage((v) => v - 1)}
              >
                Rodadas anteriores
              </button>
              <span>
                Página {roundPage + 1} de {Math.ceil(grouped.length / 5)}
              </span>
              <button
                className="btn secondary"
                disabled={(roundPage + 1) * 5 >= grouped.length}
                onClick={() => setRoundPage((v) => v + 1)}
              >
                Próximas rodadas
              </button>
            </div>
          )}
          {grouped.slice(roundPage * 5, roundPage * 5 + 5).map((r) => (
            <section className="panel" key={r}>
              <div className="panel-head">
                <h3>Rodada {r}</h3>
                <span>
                  {filtered.filter((m) => m.round === r).length} jogos
                </span>
              </div>
              <div className="match-list">
                {filtered
                  .filter((m) => m.round === r)
                  .map((m) => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      home={teamName(m.home_team_id)}
                      away={teamName(m.away_team_id)}
                      editable={isOwner}
                      details={() => setDetails(m)}
                      manage={() => setEditing(m)}
                      save={saveResult}
                      del={del}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
function MatchRow({
  details,
  manage,
  match,
  home,
  away,
  editable,
  save,
  del,
}: {
  details: () => void;
  manage: () => void;
  match: Match;
  home: string;
  away: string;
  editable: boolean;
  save: (id: string, a: string, b: string) => Promise<void> | void;
  del: (id: string) => Promise<void> | void;
}) {
  const [a, setA] = useState(match.home_score?.toString() ?? ""),
    [b, setB] = useState(match.away_score?.toString() ?? "");
  useEffect(() => {
    setA(match.home_score?.toString() ?? "");
    setB(match.away_score?.toString() ?? "");
  }, [match.home_score, match.away_score]);
  return (
    <div className="match-row">
      <div className="match-info">
        <span className={`match-state match-state-${match.status}`}>
          {matchStatus(match.status)}
        </span>
        <small>
          {match.scheduled_at
            ? formatDate(match.scheduled_at)
            : "Sem data definida"}
        </small>
        <strong>
          {home} <span>×</span> {away}
        </strong>
        <button className="btn secondary small" onClick={details}>
          Ver detalhes
        </button>
      </div>
      {editable ? (
        <div className="score">
          <button className="btn secondary small" onClick={manage}>
            Gerenciar partida
          </button>
          <input
            type="number"
            min={0}
            aria-label={`Placar de ${home}`}
            disabled={match.status === "cancelado"}
            value={a}
            onChange={(e) => setA(e.target.value)}
          />
          <span>×</span>
          <input
            type="number"
            min={0}
            aria-label={`Placar de ${away}`}
            disabled={match.status === "cancelado"}
            value={b}
            onChange={(e) => setB(e.target.value)}
          />
          <button
            className="btn secondary small"
            disabled={match.status === "cancelado"}
            onClick={() => void save(match.id, a, b)}
          >
            Salvar
          </button>
          <button
            className="icon-btn danger"
            onClick={() => void del(match.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <div className="score-view">
          <b>
            {match.home_score ?? "—"} × {match.away_score ?? "—"}
          </b>
        </div>
      )}
    </div>
  );
}
function Standings({
  championship,
  rows,
}: {
  championship: Championship | null;
  rows: Standing[];
}) {
  if (!championship)
    return (
      <Empty
        title="Selecione um campeonato"
        text="Escolha um campeonato para ver a classificação."
      />
    );
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">CLASSIFICAÇÃO</p>
          <h3>{championship.name}</h3>
        </div>
        <span>3 pontos por vitória</span>
      </div>
      <StandingsTable rows={rows} />
    </div>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Trophy size={34} />
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Stat({
  label,
  value,
  text,
}: {
  label: string;
  value: string | number;
  text: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{text}</small>
    </div>
  );
}
function statusLabel(s: Championship["status"]) {
  return s === "rascunho"
    ? "Rascunho"
    : s === "aberto"
      ? "Inscrições abertas"
      : s === "em_andamento"
        ? "Em andamento"
        : "Finalizado";
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
}
function formatDate(v: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(v));
}
function roundRobin(ids: string[]) {
  const list = [...ids];
  if (list.length % 2) list.push("BYE");
  const n = list.length,
    out: { round: number; home: string; away: string }[] = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = list[i],
        b = list[n - 1 - i];
      if (a !== "BYE" && b !== "BYE")
        out.push({
          round: r + 1,
          home: r % 2 === 0 ? a : b,
          away: r % 2 === 0 ? b : a,
        });
    }
    list.splice(1, 0, list.pop()!);
  }
  return out;
}

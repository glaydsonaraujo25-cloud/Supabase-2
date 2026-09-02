import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Medal,
  Plus,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react'
import { siteUrl, supabase } from './lib/supabase'

type Championship = {
  id: string
  owner_id: string
  name: string
  sport: string
  format: 'Pontos corridos' | 'Mata-mata' | 'Grupos + mata-mata'
  status: 'rascunho' | 'aberto' | 'em_andamento' | 'finalizado'
  start_date: string | null
  end_date: string | null
  max_teams: number
  created_at: string
}

type Team = {
  id: string
  championship_id: string
  name: string
  short_name: string | null
  city: string | null
}

type Player = {
  id: string
  team_id: string
  name: string
  shirt_number: number | null
  position: string | null
}

type Match = {
  id: string
  championship_id: string
  home_team_id: string
  away_team_id: string
  round: number
  scheduled_at: string | null
  status: 'agendado' | 'em_andamento' | 'finalizado' | 'cancelado'
  home_score: number | null
  away_score: number | null
}

type Profile = { id: string; full_name: string; email?: string | null }
type Tab = 'dashboard' | 'campeonatos' | 'times' | 'partidas' | 'classificacao'

type Standing = {
  team: Team
  points: number
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
}

const navItems: { id: Tab; label: string; icon: typeof Trophy }[] = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'campeonatos', label: 'Campeonatos', icon: Trophy },
  { id: 'times', label: 'Times e jogadores', icon: Users },
  { id: 'partidas', label: 'Partidas', icon: Swords },
  { id: 'classificacao', label: 'Classificação', icon: Medal },
]

const statusLabels: Record<Championship['status'], string> = {
  rascunho: 'Rascunho',
  aberto: 'Inscrições abertas',
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [championships, setChampionships] = useState<Championship[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [tab, setTab] = useState<Tab>('dashboard')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(new URLSearchParams(window.location.search).get('reset') === '1')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorDescription = params.get('error_description')
    if (errorDescription) setNotice(decodeURIComponent(errorDescription.replace(/\+/g, ' ')))
    else if (params.get('confirmed') === '1') setNotice('E-mail confirmado com sucesso. Você já pode acessar sua conta.')

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (!nextSession) {
        setProfile(null)
        setChampionships([])
        setTeams([])
        setPlayers([])
        setMatches([])
      }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user.id && !recoveryMode) void loadData()
  }, [session?.user.id, recoveryMode])

  async function loadData(preferredId?: string) {
    if (!session?.user.id) return
    setLoading(true)
    setNotice('')

    const [profileResult, championshipResult, teamResult, playerResult, matchResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('id', session.user.id).maybeSingle(),
      supabase.from('championships').select('*').order('created_at', { ascending: false }),
      supabase.from('teams').select('*').order('name'),
      supabase.from('players').select('*').order('name'),
      supabase.from('matches').select('*').order('round').order('scheduled_at'),
    ])

    const firstError = profileResult.error || championshipResult.error || teamResult.error || playerResult.error || matchResult.error
    if (firstError) setNotice(firstError.message)

    if (profileResult.data) setProfile(profileResult.data as Profile)
    if (championshipResult.data) {
      const rows = championshipResult.data as Championship[]
      setChampionships(rows)
      const desired = preferredId || selectedId
      if (desired && rows.some((item) => item.id === desired)) setSelectedId(desired)
      else setSelectedId(rows[0]?.id || '')
    }
    if (teamResult.data) setTeams(teamResult.data as Team[])
    if (playerResult.data) setPlayers(playerResult.data as Player[])
    if (matchResult.data) setMatches(matchResult.data as Match[])
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const selected = championships.find((item) => item.id === selectedId) || null
  const selectedTeams = useMemo(() => teams.filter((item) => item.championship_id === selectedId), [teams, selectedId])
  const selectedTeamIds = useMemo(() => new Set(selectedTeams.map((item) => item.id)), [selectedTeams])
  const selectedPlayers = useMemo(() => players.filter((item) => selectedTeamIds.has(item.team_id)), [players, selectedTeamIds])
  const selectedMatches = useMemo(() => matches.filter((item) => item.championship_id === selectedId), [matches, selectedId])
  const standings = useMemo(() => calculateStandings(selectedTeams, selectedMatches), [selectedTeams, selectedMatches])

  if (recoveryMode && session) return <ResetPasswordScreen onDone={() => { setRecoveryMode(false); window.history.replaceState({}, '', '/') }} />
  if (loading && !session) return <LoadingScreen />
  if (!session) return <AuthScreen initialMessage={notice} />

  const activeLabel = navItems.find((item) => item.id === tab)?.label || 'Gestor de campeonatos'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Trophy size={24} /></div>
          <div><strong>Bracketly</strong><span>Gestor de campeonatos</span></div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return <button key={item.id} className={tab === item.id ? 'nav-button active' : 'nav-button'} onClick={() => setTab(item.id)}><Icon size={18} /><span>{item.label}</span></button>
          })}
        </nav>

        <div className="sidebar-account">
          <div className="account-card"><CircleUserRound size={20} /><div><strong>{profile?.full_name || session.user.email}</strong><span>{session.user.email}</span></div></div>
          <button className="ghost-button" onClick={signOut}><LogOut size={17} /> Sair</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">Painel do organizador</p><h1>{activeLabel}</h1></div>
          <div className="topbar-actions">
            {championships.length > 0 && <select className="championship-select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>{championships.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
            <button className="secondary-button" onClick={() => void loadData()}><RefreshCw size={16} /> Atualizar</button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}

        {loading ? <LoadingBlock /> : <>
          {tab === 'dashboard' && <Dashboard championship={selected} teams={selectedTeams} players={selectedPlayers} matches={selectedMatches} standings={standings} onCreate={() => setTab('campeonatos')} />}
          {tab === 'campeonatos' && <ChampionshipsPanel championships={championships} selectedId={selectedId} onSelect={setSelectedId} userId={session.user.id} onChanged={loadData} />}
          {tab === 'times' && <TeamsPanel championship={selected} teams={selectedTeams} players={players} onChanged={() => loadData(selectedId)} />}
          {tab === 'partidas' && <MatchesPanel championship={selected} teams={selectedTeams} matches={selectedMatches} onChanged={() => loadData(selectedId)} />}
          {tab === 'classificacao' && <StandingsPanel championship={selected} standings={standings} />}
        </>}
      </main>
    </div>
  )
}

function Dashboard({ championship, teams, players, matches, standings, onCreate }: { championship: Championship | null; teams: Team[]; players: Player[]; matches: Match[]; standings: Standing[]; onCreate: () => void }) {
  if (!championship) return <EmptyState icon={<Trophy size={34} />} title="Crie seu primeiro campeonato" description="Cadastre a competição e depois adicione times, jogadores e partidas." action={<button className="primary-button" onClick={onCreate}><Plus size={16} /> Novo campeonato</button>} />

  const finished = matches.filter((item) => item.status === 'finalizado').length
  const nextMatch = matches.filter((item) => item.status === 'agendado' && item.scheduled_at).sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))[0]
  const teamName = (id: string) => teams.find((team) => team.id === id)?.name || 'Time'

  return <div className="page-stack">
    <section className="hero-card">
      <div><span className={`status-pill status-${championship.status}`}>{statusLabels[championship.status]}</span><h2>{championship.name}</h2><p>{championship.sport} · {championship.format} · até {championship.max_teams} times</p></div>
      <Trophy size={72} strokeWidth={1.2} />
    </section>

    <section className="stats-grid">
      <StatCard label="Times" value={teams.length} detail={`de ${championship.max_teams} vagas`} icon={<Users size={20} />} />
      <StatCard label="Jogadores" value={players.length} detail="cadastrados" icon={<UserPlus size={20} />} />
      <StatCard label="Partidas" value={matches.length} detail={`${finished} finalizadas`} icon={<Swords size={20} />} />
      <StatCard label="Líder" value={standings[0]?.team.short_name || standings[0]?.team.name || '—'} detail={standings[0] ? `${standings[0].points} pontos` : 'sem resultados'} icon={<Medal size={20} />} />
    </section>

    <section className="dashboard-grid">
      <div className="panel-card">
        <div className="section-heading"><div><p className="eyebrow">Classificação</p><h3>Top 5</h3></div></div>
        {standings.length ? <div className="mini-ranking">{standings.slice(0, 5).map((row, index) => <div key={row.team.id}><span className="rank-number">{index + 1}</span><strong>{row.team.name}</strong><span>{row.points} pts</span></div>)}</div> : <p className="muted">A classificação aparecerá após cadastrar times.</p>}
      </div>
      <div className="panel-card">
        <div className="section-heading"><div><p className="eyebrow">Agenda</p><h3>Próxima partida</h3></div></div>
        {nextMatch ? <div className="next-match"><span>Rodada {nextMatch.round}</span><strong>{teamName(nextMatch.home_team_id)} <small>vs</small> {teamName(nextMatch.away_team_id)}</strong><p>{formatDateTime(nextMatch.scheduled_at)}</p></div> : <p className="muted">Nenhuma partida agendada.</p>}
      </div>
    </section>
  </div>
}

function ChampionshipsPanel({ championships, selectedId, onSelect, userId, onChanged }: { championships: Championship[]; selectedId: string; onSelect: (id: string) => void; userId: string; onChanged: (id?: string) => Promise<void> }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [sport, setSport] = useState('Futebol')
  const [format, setFormat] = useState<Championship['format']>('Pontos corridos')
  const [startDate, setStartDate] = useState('')
  const [maxTeams, setMaxTeams] = useState(8)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function createChampionship(event: FormEvent) {
    event.preventDefault(); setBusy(true); setFeedback('')
    const { data, error } = await supabase.from('championships').insert({ owner_id: userId, name: name.trim(), sport: sport.trim(), format, start_date: startDate || null, max_teams: maxTeams }).select('id').single()
    if (error) setFeedback(error.message)
    else {
      setName(''); setStartDate(''); setShowForm(false)
      await onChanged(data.id)
      onSelect(data.id)
    }
    setBusy(false)
  }

  async function removeChampionship(item: Championship) {
    if (!window.confirm(`Excluir o campeonato “${item.name}” e todos os seus times, jogadores e partidas?`)) return
    const { error } = await supabase.from('championships').delete().eq('id', item.id)
    if (error) setFeedback(error.message)
    else await onChanged()
  }

  async function updateStatus(item: Championship, status: Championship['status']) {
    const { error } = await supabase.from('championships').update({ status, updated_at: new Date().toISOString() }).eq('id', item.id)
    if (error) setFeedback(error.message)
    else await onChanged(item.id)
  }

  return <div className="page-stack">
    <div className="page-actions"><div><p className="muted">Você pode criar vários campeonatos e manter os dados separados.</p></div><button className="primary-button" onClick={() => setShowForm((value) => !value)}><Plus size={16} /> Novo campeonato</button></div>
    {showForm && <form className="form-card form-grid" onSubmit={createChampionship}>
      <label className="span-2">Nome do campeonato<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Copa da Firma 2026" minLength={3} required /></label>
      <label>Modalidade<input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Futebol" required /></label>
      <label>Formato<select value={format} onChange={(e) => setFormat(e.target.value as Championship['format'])}><option>Pontos corridos</option><option>Mata-mata</option><option>Grupos + mata-mata</option></select></label>
      <label>Data de início<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
      <label>Máximo de times<input type="number" min={2} max={64} value={maxTeams} onChange={(e) => setMaxTeams(Number(e.target.value))} required /></label>
      {feedback && <div className="notice span-2">{feedback}</div>}
      <div className="form-actions span-2"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? 'Criando...' : 'Criar campeonato'}</button></div>
    </form>}

    {feedback && !showForm && <div className="notice">{feedback}</div>}
    {championships.length === 0 ? <EmptyState icon={<Trophy size={32} />} title="Nenhum campeonato ainda" description="Crie sua primeira competição para começar." /> : <div className="cards-grid">{championships.map((item) => <article key={item.id} className={selectedId === item.id ? 'champ-card selected' : 'champ-card'} onClick={() => onSelect(item.id)}>
      <div className="champ-card-top"><span className={`status-pill status-${item.status}`}>{statusLabels[item.status]}</span><button className="icon-button danger" title="Excluir campeonato" onClick={(e) => { e.stopPropagation(); void removeChampionship(item) }}><Trash2 size={16} /></button></div>
      <div><p className="eyebrow">{item.sport}</p><h3>{item.name}</h3><p>{item.format}</p></div>
      <div className="champ-meta"><span><Users size={15} /> até {item.max_teams} times</span><span><CalendarDays size={15} /> {formatDate(item.start_date)}</span></div>
      <label onClick={(e) => e.stopPropagation()}>Status<select value={item.status} onChange={(e) => void updateStatus(item, e.target.value as Championship['status'])}><option value="rascunho">Rascunho</option><option value="aberto">Inscrições abertas</option><option value="em_andamento">Em andamento</option><option value="finalizado">Finalizado</option></select></label>
      <button className="text-button" onClick={() => onSelect(item.id)}>Gerenciar <ChevronRight size={15} /></button>
    </article>)}</div>}
  </div>
}

function TeamsPanel({ championship, teams, players, onChanged }: { championship: Championship | null; teams: Team[]; players: Player[]; onChanged: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [city, setCity] = useState('')
  const [expandedTeam, setExpandedTeam] = useState<string>('')
  const [playerName, setPlayerName] = useState('')
  const [shirtNumber, setShirtNumber] = useState('')
  const [position, setPosition] = useState('')
  const [feedback, setFeedback] = useState('')

  if (!championship) return <EmptyState icon={<Users size={32} />} title="Selecione um campeonato" description="Crie ou selecione um campeonato antes de cadastrar times." />

  async function addTeam(event: FormEvent) {
    event.preventDefault(); setFeedback('')
    if (teams.length >= championship.max_teams) return setFeedback('O limite de times deste campeonato foi atingido.')
    const { error } = await supabase.from('teams').insert({ championship_id: championship.id, name: name.trim(), short_name: shortName.trim().toUpperCase() || null, city: city.trim() || null })
    if (error) setFeedback(error.message)
    else { setName(''); setShortName(''); setCity(''); await onChanged() }
  }

  async function addPlayer(event: FormEvent, teamId: string) {
    event.preventDefault(); setFeedback('')
    const { error } = await supabase.from('players').insert({ team_id: teamId, name: playerName.trim(), shirt_number: shirtNumber ? Number(shirtNumber) : null, position: position.trim() || null })
    if (error) setFeedback(error.message)
    else { setPlayerName(''); setShirtNumber(''); setPosition(''); await onChanged() }
  }

  async function removeTeam(team: Team) {
    if (!window.confirm(`Excluir o time “${team.name}” e seus jogadores?`)) return
    const { error } = await supabase.from('teams').delete().eq('id', team.id)
    if (error) setFeedback(error.message); else await onChanged()
  }

  async function removePlayer(player: Player) {
    const { error } = await supabase.from('players').delete().eq('id', player.id)
    if (error) setFeedback(error.message); else await onChanged()
  }

  return <div className="page-stack">
    <form className="form-card inline-form" onSubmit={addTeam}>
      <div><p className="eyebrow">Novo time</p><h3>{teams.length}/{championship.max_teams} times cadastrados</h3></div>
      <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do time" required /></label>
      <label>Sigla<input value={shortName} onChange={(e) => setShortName(e.target.value.slice(0, 5))} placeholder="ABC" minLength={2} maxLength={5} /></label>
      <label>Cidade<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Opcional" /></label>
      <button className="primary-button"><Plus size={16} /> Adicionar</button>
    </form>
    {feedback && <div className="notice">{feedback}</div>}

    {teams.length === 0 ? <EmptyState icon={<Users size={32} />} title="Cadastre os participantes" description="Adicione os times que disputarão este campeonato." /> : <div className="team-list">{teams.map((team) => {
      const roster = players.filter((player) => player.team_id === team.id)
      const open = expandedTeam === team.id
      return <article key={team.id} className="team-card">
        <div className="team-summary">
          <button className="team-main" onClick={() => setExpandedTeam(open ? '' : team.id)}><span className="team-badge">{team.short_name || initials(team.name)}</span><div><strong>{team.name}</strong><span>{team.city || 'Cidade não informada'} · {roster.length} jogadores</span></div></button>
          <button className="icon-button danger" onClick={() => void removeTeam(team)} title="Excluir time"><Trash2 size={16} /></button>
        </div>
        {open && <div className="roster-area">
          <div className="roster-list">{roster.length ? roster.map((player) => <div key={player.id} className="player-row"><span className="shirt-number">{player.shirt_number ?? '—'}</span><div><strong>{player.name}</strong><span>{player.position || 'Posição não informada'}</span></div><button className="icon-button danger" onClick={() => void removePlayer(player)}><Trash2 size={15} /></button></div>) : <p className="muted">Nenhum jogador cadastrado.</p>}</div>
          <form className="player-form" onSubmit={(event) => void addPlayer(event, team.id)}>
            <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Nome do jogador" required />
            <input type="number" min={0} max={99} value={shirtNumber} onChange={(e) => setShirtNumber(e.target.value)} placeholder="Nº" />
            <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Posição" />
            <button className="secondary-button"><UserPlus size={16} /> Jogador</button>
          </form>
        </div>}
      </article>
    })}</div>}
  </div>
}

function MatchesPanel({ championship, teams, matches, onChanged }: { championship: Championship | null; teams: Team[]; matches: Match[]; onChanged: () => Promise<void> }) {
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [round, setRound] = useState(1)
  const [scheduledAt, setScheduledAt] = useState('')
  const [feedback, setFeedback] = useState('')

  if (!championship) return <EmptyState icon={<Swords size={32} />} title="Selecione um campeonato" description="As partidas ficam vinculadas ao campeonato selecionado." />
  const teamName = (id: string) => teams.find((team) => team.id === id)?.name || 'Time removido'

  async function addMatch(event: FormEvent) {
    event.preventDefault(); setFeedback('')
    if (home === away) return setFeedback('Selecione times diferentes.')
    const { error } = await supabase.from('matches').insert({ championship_id: championship.id, home_team_id: home, away_team_id: away, round, scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null })
    if (error) setFeedback(error.message)
    else { setHome(''); setAway(''); setScheduledAt(''); await onChanged() }
  }

  async function saveResult(match: Match, homeScore: string, awayScore: string) {
    const hs = Number(homeScore); const as = Number(awayScore)
    if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) return setFeedback('Informe placares válidos.')
    const { error } = await supabase.from('matches').update({ home_score: hs, away_score: as, status: 'finalizado' }).eq('id', match.id)
    if (error) setFeedback(error.message); else await onChanged()
  }

  async function removeMatch(id: string) {
    const { error } = await supabase.from('matches').delete().eq('id', id)
    if (error) setFeedback(error.message); else await onChanged()
  }

  return <div className="page-stack">
    {teams.length < 2 ? <div className="notice">Cadastre pelo menos dois times para criar uma partida.</div> : <form className="form-card match-form" onSubmit={addMatch}>
      <div className="span-2"><p className="eyebrow">Nova partida</p><h3>Monte a rodada</h3></div>
      <label>Mandante<select value={home} onChange={(e) => setHome(e.target.value)} required><option value="">Selecione</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      <label>Visitante<select value={away} onChange={(e) => setAway(e.target.value)} required><option value="">Selecione</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      <label>Rodada<input type="number" min={1} value={round} onChange={(e) => setRound(Number(e.target.value))} required /></label>
      <label>Data e hora<input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>
      <div className="form-actions span-2"><button className="primary-button"><Plus size={16} /> Adicionar partida</button></div>
    </form>}
    {feedback && <div className="notice">{feedback}</div>}

    {matches.length === 0 ? <EmptyState icon={<CalendarDays size={32} />} title="Nenhuma partida cadastrada" description="Crie partidas para montar a agenda e alimentar a classificação." /> : <div className="match-list">{matches.map((match) => <MatchCard key={match.id} match={match} homeName={teamName(match.home_team_id)} awayName={teamName(match.away_team_id)} onSave={saveResult} onDelete={removeMatch} />)}</div>}
  </div>
}

function MatchCard({ match, homeName, awayName, onSave, onDelete }: { match: Match; homeName: string; awayName: string; onSave: (match: Match, homeScore: string, awayScore: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [homeScore, setHomeScore] = useState(match.home_score?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(match.away_score?.toString() ?? '')

  return <article className="match-card">
    <div className="match-meta"><span>Rodada {match.round}</span><span>{formatDateTime(match.scheduled_at)}</span></div>
    <div className="score-line">
      <strong>{homeName}</strong>
      <div className="score-inputs"><input type="number" min={0} value={homeScore} onChange={(e) => setHomeScore(e.target.value)} aria-label={`Placar ${homeName}`} /><span>×</span><input type="number" min={0} value={awayScore} onChange={(e) => setAwayScore(e.target.value)} aria-label={`Placar ${awayName}`} /></div>
      <strong>{awayName}</strong>
    </div>
    <div className="match-actions"><span className={`match-status ${match.status}`}>{match.status === 'finalizado' ? 'Finalizada' : match.status === 'cancelado' ? 'Cancelada' : 'Agendada'}</span><div><button className="secondary-button compact" onClick={() => void onSave(match, homeScore, awayScore)}>Salvar resultado</button><button className="icon-button danger" onClick={() => void onDelete(match.id)}><Trash2 size={16} /></button></div></div>
  </article>
}

function StandingsPanel({ championship, standings }: { championship: Championship | null; standings: Standing[] }) {
  if (!championship) return <EmptyState icon={<Medal size={32} />} title="Selecione um campeonato" description="A classificação é calculada automaticamente pelos resultados." />
  return <div className="page-stack">
    <div className="panel-card"><div className="section-heading"><div><p className="eyebrow">{championship.name}</p><h3>Classificação geral</h3></div><span className="muted">3 pts vitória · 1 pt empate</span></div>
      {standings.length === 0 ? <p className="muted">Cadastre times para visualizar a tabela.</p> : <div className="table-scroll"><table className="standings-table"><thead><tr><th>#</th><th>Time</th><th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th></tr></thead><tbody>{standings.map((row, index) => <tr key={row.team.id}><td><span className={index < 3 ? 'position-badge top' : 'position-badge'}>{index + 1}</span></td><td><div className="table-team"><span className="tiny-team-badge">{row.team.short_name || initials(row.team.name)}</span><strong>{row.team.name}</strong></div></td><td><strong>{row.points}</strong></td><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.goalsFor}</td><td>{row.goalsAgainst}</td><td>{row.goalDiff}</td></tr>)}</tbody></table></div>}
    </div>
  </div>
}

function AuthScreen({ initialMessage }: { initialMessage?: string }) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(initialMessage || '')

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setFeedback('')
    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${siteUrl}/?confirmed=1` } })
      setFeedback(error ? translateAuthError(error.message) : 'Cadastro realizado. Confirme o link enviado para o seu e-mail.')
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/?reset=1` })
      setFeedback(error ? translateAuthError(error.message) : 'Enviamos o link de redefinição de senha para o seu e-mail.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setFeedback(translateAuthError(error.message))
    }
    setBusy(false)
  }

  return <div className="auth-page">
    <section className="auth-showcase">
      <div className="auth-brand"><div className="brand-mark large"><Trophy size={28} /></div><strong>Bracketly</strong></div>
      <div className="auth-copy"><span className="hero-badge"><ShieldCheck size={16} /> Dados protegidos pelo Supabase</span><h1>Seu campeonato organizado do primeiro time até a final.</h1><p>Crie competições, cadastre equipes e jogadores, registre partidas e acompanhe a classificação automaticamente.</p></div>
      <div className="auth-features"><span><Trophy size={18} /> Vários campeonatos</span><span><Users size={18} /> Times e elencos</span><span><Swords size={18} /> Partidas e placares</span><span><Medal size={18} /> Classificação automática</span></div>
    </section>

    <section className="auth-side"><form className="auth-card" onSubmit={submit}>
      <div><p className="eyebrow">Sua conta</p><h2>{mode === 'login' ? 'Entre no Bracketly' : mode === 'register' ? 'Crie sua conta' : 'Redefina sua senha'}</h2><p className="muted">{mode === 'login' ? 'Acesse seus campeonatos e continue de onde parou.' : mode === 'register' ? 'Seu espaço fica separado e protegido por usuário.' : 'Você receberá um link seguro por e-mail.'}</p></div>
      {mode === 'register' && <label>Nome completo<input value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={3} required /></label>}
      <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      {mode !== 'forgot' && <label>Senha<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /><small>Use pelo menos 8 caracteres.</small></label>}
      {feedback && <div className="notice">{feedback}</div>}
      <button className="primary-button large-button" disabled={busy}>{busy ? 'Processando...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar link'}</button>
      {mode === 'login' && <button type="button" className="link-button" onClick={() => { setMode('forgot'); setFeedback('') }}><KeyRound size={15} /> Esqueci minha senha</button>}
      <button type="button" className="link-button" onClick={() => { setMode(mode === 'register' ? 'login' : mode === 'forgot' ? 'login' : 'register'); setFeedback('') }}>{mode === 'login' ? 'Ainda não tenho uma conta' : 'Voltar para o login'}</button>
    </form></section>
  </div>
}

function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirmPassword) return setFeedback('As senhas não coincidem.')
    setBusy(true); setFeedback('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setFeedback(translateAuthError(error.message))
    else { await supabase.auth.signOut(); onDone() }
    setBusy(false)
  }

  return <div className="center-page"><form className="auth-card compact-card" onSubmit={submit}><div className="brand-mark large"><KeyRound size={26} /></div><div><p className="eyebrow">Segurança</p><h2>Escolha uma nova senha</h2></div><label>Nova senha<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label><label>Confirmar senha<input type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></label>{feedback && <div className="notice">{feedback}</div>}<button className="primary-button" disabled={busy}>{busy ? 'Salvando...' : 'Salvar nova senha'}</button></form></div>
}

function StatCard({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: React.ReactNode }) {
  return <article className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>
}

function LoadingScreen() { return <div className="center-page"><div className="loader" /><p>Carregando...</p></div> }
function LoadingBlock() { return <div className="loading-block"><div className="loader" /><span>Atualizando dados...</span></div> }

function calculateStandings(teams: Team[], matches: Match[]): Standing[] {
  const map = new Map<string, Standing>()
  teams.forEach((team) => map.set(team.id, { team, points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 }))

  matches.filter((match) => match.status === 'finalizado' && match.home_score !== null && match.away_score !== null).forEach((match) => {
    const home = map.get(match.home_team_id); const away = map.get(match.away_team_id)
    if (!home || !away) return
    const hs = match.home_score as number; const as = match.away_score as number
    home.played += 1; away.played += 1
    home.goalsFor += hs; home.goalsAgainst += as
    away.goalsFor += as; away.goalsAgainst += hs
    if (hs > as) { home.wins += 1; home.points += 3; away.losses += 1 }
    else if (as > hs) { away.wins += 1; away.points += 3; home.losses += 1 }
    else { home.draws += 1; away.draws += 1; home.points += 1; away.points += 1 }
  })

  const rows = [...map.values()]
  rows.forEach((row) => { row.goalDiff = row.goalsFor - row.goalsAgainst })
  return rows.sort((a, b) => b.points - a.points || b.wins - a.wins || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.team.name.localeCompare(b.team.name))
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') }
function formatDate(value: string | null) { if (!value) return 'Sem data'; return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`)) }
function formatDateTime(value: string | null) { if (!value) return 'Data a definir'; return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }
function translateAuthError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (normalized.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (normalized.includes('user already registered')) return 'Este e-mail já está cadastrado.'
  if (normalized.includes('password should be')) return 'A senha não atende aos requisitos mínimos.'
  return message
}

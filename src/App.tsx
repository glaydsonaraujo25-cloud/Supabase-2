import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { supabase } from './lib/supabase'

type Profile = {
  id: string
  full_name: string
  role: 'admin' | 'usuario'
  soldier_id: string | null
}

type Soldier = {
  id: string
  full_name: string
  rank: string
  war_name: string | null
  organization: string | null
  active: boolean
}

type ServiceType = {
  id: string
  name: string
  description: string | null
  default_start: string | null
  default_end: string | null
}

type Shift = {
  id: string
  soldier_id: string
  service_type_id: string
  service_date: string
  start_time: string
  end_time: string
  status: string
  notes: string | null
  soldiers: { full_name: string; rank: string; war_name: string | null } | null
  service_types: { name: string } | null
}

type SwapRequest = {
  id: string
  shift_id: string
  requester_id: string
  target_soldier_id: string | null
  reason: string
  status: string
  admin_note: string | null
  created_at: string
}

type Tab = 'dashboard' | 'escala' | 'militares' | 'servicos' | 'trocas'

const tabs: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Visão geral' },
  { id: 'escala', label: 'Escala' },
  { id: 'militares', label: 'Militares' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'trocas', label: 'Trocas' },
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [services, setServices] = useState<ServiceType[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tab, setTab] = useState<Tab>('dashboard')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) setProfile(null)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user.id) return
    void loadData()
  }, [session?.user.id])

  async function loadData() {
    if (!session?.user.id) return
    setLoading(true)
    setMessage('')

    const { data: myProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, soldier_id')
      .eq('id', session.user.id)
      .single()

    if (profileError) {
      setMessage(`Não foi possível carregar o perfil: ${profileError.message}`)
      setLoading(false)
      return
    }

    setProfile(myProfile as Profile)

    const [soldierResult, serviceResult, shiftResult, swapResult] = await Promise.all([
      supabase.from('soldiers').select('id, full_name, rank, war_name, organization, active').order('rank').order('full_name'),
      supabase.from('service_types').select('id, name, description, default_start, default_end').eq('active', true).order('name'),
      supabase
        .from('shifts')
        .select('id, soldier_id, service_type_id, service_date, start_time, end_time, status, notes, soldiers(full_name, rank, war_name), service_types(name)')
        .order('service_date')
        .order('start_time'),
      supabase.from('swap_requests').select('id, shift_id, requester_id, target_soldier_id, reason, status, admin_note, created_at').order('created_at', { ascending: false }),
    ])

    if (soldierResult.data) setSoldiers(soldierResult.data as Soldier[])
    if (serviceResult.data) setServices(serviceResult.data as ServiceType[])
    if (shiftResult.data) setShifts(shiftResult.data as unknown as Shift[])
    if (swapResult.data) setSwaps(swapResult.data as SwapRequest[])

    if ((myProfile as Profile).role === 'admin') {
      const { data: allProfiles } = await supabase.from('profiles').select('id, full_name, role, soldier_id').order('full_name')
      if (allProfiles) setProfiles(allProfiles as Profile[])
    }

    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return shifts.filter((shift) => shift.service_date >= today && shift.status !== 'cancelado')
  }, [shifts])

  const myShifts = useMemo(
    () => shifts.filter((shift) => profile?.soldier_id && shift.soldier_id === profile.soldier_id),
    [shifts, profile?.soldier_id],
  )

  if (loading && !session) return <LoadingScreen />
  if (!session) return <AuthScreen />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><ShieldCheck size={24} /></div>
          <div><strong>Escala de Serviço</strong><span>Gestão administrativa</span></div>
        </div>

        <nav>
          {tabs.map((item) => (
            <button key={item.id} className={tab === item.id ? 'nav-button active' : 'nav-button'} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="account-card">
            <UserRound size={18} />
            <div><strong>{profile?.full_name || session.user.email}</strong><span>{isAdmin ? 'Administrador' : 'Usuário'}</span></div>
          </div>
          <button className="ghost-button" onClick={signOut}><LogOut size={17} /> Sair</button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Sistema de escala</p>
            <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
          </div>
          <button className="secondary-button" onClick={() => void loadData()}><RefreshCw size={16} /> Atualizar</button>
        </header>

        {message && <div className="notice">{message}</div>}
        {loading ? <LoadingBlock /> : (
          <>
            {tab === 'dashboard' && <Dashboard upcoming={upcoming} myShifts={myShifts} soldiers={soldiers} swaps={swaps} isAdmin={isAdmin} />}
            {tab === 'escala' && <SchedulePanel shifts={shifts} soldiers={soldiers} services={services} isAdmin={isAdmin} mySoldierId={profile?.soldier_id ?? null} onChanged={loadData} />}
            {tab === 'militares' && <SoldiersPanel soldiers={soldiers} profiles={profiles} isAdmin={isAdmin} onChanged={loadData} />}
            {tab === 'servicos' && <ServicesPanel services={services} isAdmin={isAdmin} onChanged={loadData} />}
            {tab === 'trocas' && <SwapsPanel swaps={swaps} shifts={shifts} soldiers={soldiers} isAdmin={isAdmin} mySoldierId={profile?.soldier_id ?? null} onChanged={loadData} />}
          </>
        )}
      </main>
    </div>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFeedback('')

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      setFeedback(error ? error.message : 'Cadastro realizado. Verifique seu e-mail para confirmar a conta.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setFeedback(error.message)
    }
    setBusy(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="hero-badge"><ShieldCheck size={18} /> Controle de acesso com Supabase</div>
        <h1>Escalas organizadas, consulta rápida e histórico em um só lugar.</h1>
        <p>Aplicação para gestão administrativa de equipes e serviços, com autenticação, banco de dados e permissões por perfil.</p>
        <div className="feature-list"><span>Escala centralizada</span><span>Pedidos de troca</span><span>Perfis de acesso</span><span>Banco PostgreSQL</span></div>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div><p className="eyebrow">Acesso</p><h2>{mode === 'login' ? 'Entrar no sistema' : 'Criar sua conta'}</h2></div>
        {mode === 'register' && <label>Nome completo<input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>}
        <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Senha<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {feedback && <div className="notice">{feedback}</div>}
        <button className="primary-button" disabled={busy}>{busy ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}</button>
        <button type="button" className="link-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setFeedback('') }}>
          {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho uma conta'}
        </button>
      </form>
    </div>
  )
}

function Dashboard({ upcoming, myShifts, soldiers, swaps, isAdmin }: { upcoming: Shift[]; myShifts: Shift[]; soldiers: Soldier[]; swaps: SwapRequest[]; isAdmin: boolean }) {
  const cards = isAdmin
    ? [
        { label: 'Militares ativos', value: soldiers.filter((item) => item.active).length, icon: Users },
        { label: 'Próximos serviços', value: upcoming.length, icon: CalendarDays },
        { label: 'Trocas pendentes', value: swaps.filter((item) => item.status === 'pendente').length, icon: RefreshCw },
      ]
    : [
        { label: 'Meus serviços', value: myShifts.length, icon: ClipboardList },
        { label: 'Próximos serviços', value: myShifts.filter((item) => item.service_date >= new Date().toISOString().slice(0, 10)).length, icon: CalendarDays },
        { label: 'Trocas pendentes', value: swaps.filter((item) => item.status === 'pendente').length, icon: RefreshCw },
      ]

  return <section className="content-stack">
    <div className="stats-grid">{cards.map(({ label, value, icon: Icon }) => <article className="stat-card" key={label}><Icon size={21} /><div><span>{label}</span><strong>{value}</strong></div></article>)}</div>
    <div className="panel"><div className="panel-heading"><div><p className="eyebrow">Próximos dias</p><h2>{isAdmin ? 'Próximos serviços' : 'Minha escala'}</h2></div></div><ShiftTable shifts={isAdmin ? upcoming.slice(0, 8) : myShifts.slice(0, 8)} /></div>
  </section>
}

function SchedulePanel({ shifts, soldiers, services, isAdmin, mySoldierId, onChanged }: { shifts: Shift[]; soldiers: Soldier[]; services: ServiceType[]; isAdmin: boolean; mySoldierId: string | null; onChanged: () => Promise<void> }) {
  const [soldierId, setSoldierId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('08:00')
  const [notes, setNotes] = useState('')
  const visible = isAdmin ? shifts : shifts.filter((shift) => shift.soldier_id === mySoldierId)

  async function createShift(event: FormEvent) {
    event.preventDefault()
    const { error } = await supabase.from('shifts').insert({ soldier_id: soldierId, service_type_id: serviceId, service_date: date, start_time: start, end_time: end, notes: notes || null })
    if (!error) { setDate(''); setNotes(''); await onChanged() }
    else alert(error.message)
  }

  function changeService(id: string) {
    setServiceId(id)
    const item = services.find((service) => service.id === id)
    if (item?.default_start) setStart(item.default_start.slice(0, 5))
    if (item?.default_end) setEnd(item.default_end.slice(0, 5))
  }

  return <section className="content-stack">
    {isAdmin && <form className="panel form-grid" onSubmit={createShift}>
      <div className="panel-heading full"><div><p className="eyebrow">Nova escala</p><h2>Adicionar serviço</h2></div></div>
      <label>Militar<select value={soldierId} onChange={(e) => setSoldierId(e.target.value)} required><option value="">Selecione</option>{soldiers.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.rank} {s.war_name || s.full_name}</option>)}</select></label>
      <label>Serviço<select value={serviceId} onChange={(e) => changeService(e.target.value)} required><option value="">Selecione</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <label>Início<input type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
      <label>Fim<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></label>
      <label className="wide">Observação<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></label>
      <button className="primary-button fit"><Plus size={16} /> Adicionar</button>
    </form>}
    <div className="panel"><div className="panel-heading"><div><p className="eyebrow">Calendário</p><h2>{isAdmin ? 'Escala geral' : 'Meus serviços'}</h2></div></div><ShiftTable shifts={visible} /></div>
  </section>
}

function SoldiersPanel({ soldiers, profiles, isAdmin, onChanged }: { soldiers: Soldier[]; profiles: Profile[]; isAdmin: boolean; onChanged: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [rank, setRank] = useState('')
  const [warName, setWarName] = useState('')
  const [organization, setOrganization] = useState('')
  const [profileId, setProfileId] = useState('')

  async function addSoldier(event: FormEvent) {
    event.preventDefault()
    const { data, error } = await supabase.from('soldiers').insert({ full_name: name, rank, war_name: warName || null, organization: organization || null }).select('id').single()
    if (error) return alert(error.message)
    if (profileId && data?.id) {
      const { error: linkError } = await supabase.from('profiles').update({ soldier_id: data.id }).eq('id', profileId)
      if (linkError) return alert(`Militar criado, mas o vínculo falhou: ${linkError.message}`)
    }
    setName(''); setRank(''); setWarName(''); setOrganization(''); setProfileId(''); await onChanged()
  }

  if (!isAdmin) return <EmptyState title="Acesso administrativo" text="O cadastro de militares é disponível apenas para administradores." />

  return <section className="content-stack">
    <form className="panel form-grid" onSubmit={addSoldier}><div className="panel-heading full"><div><p className="eyebrow">Efetivo</p><h2>Cadastrar militar</h2></div></div>
      <label>Nome completo<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>Posto/graduação<input value={rank} onChange={(e) => setRank(e.target.value)} placeholder="Ex.: 3º Sgt" required /></label>
      <label>Nome de guerra<input value={warName} onChange={(e) => setWarName(e.target.value)} /></label>
      <label>Organização/Seção<input value={organization} onChange={(e) => setOrganization(e.target.value)} /></label>
      <label className="wide">Vincular conta<select value={profileId} onChange={(e) => setProfileId(e.target.value)}><option value="">Nenhuma conta</option>{profiles.filter((p) => !p.soldier_id).map((p) => <option key={p.id} value={p.id}>{p.full_name || p.id}</option>)}</select></label>
      <button className="primary-button fit"><Plus size={16} /> Cadastrar</button>
    </form>
    <div className="panel"><div className="panel-heading"><div><p className="eyebrow">Cadastros</p><h2>Militares</h2></div><span className="pill">{soldiers.length}</span></div><div className="cards-list">{soldiers.map((s) => <article className="person-row" key={s.id}><div className="avatar">{(s.war_name || s.full_name).slice(0, 1)}</div><div><strong>{s.rank} {s.war_name || s.full_name}</strong><span>{s.full_name} {s.organization ? `• ${s.organization}` : ''}</span></div><span className={s.active ? 'status success' : 'status'}>{s.active ? 'Ativo' : 'Inativo'}</span></article>)}</div></div>
  </section>
}

function ServicesPanel({ services, isAdmin, onChanged }: { services: ServiceType[]; isAdmin: boolean; onChanged: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('08:00')

  async function addService(event: FormEvent) {
    event.preventDefault()
    const { error } = await supabase.from('service_types').insert({ name, description: description || null, default_start: start, default_end: end })
    if (error) return alert(error.message)
    setName(''); setDescription(''); await onChanged()
  }

  return <section className="content-stack">
    {isAdmin && <form className="panel form-grid" onSubmit={addService}><div className="panel-heading full"><div><p className="eyebrow">Configuração</p><h2>Novo tipo de serviço</h2></div></div><label>Nome<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Descrição<input value={description} onChange={(e) => setDescription(e.target.value)} /></label><label>Início padrão<input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>Fim padrão<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label><button className="primary-button fit"><Plus size={16} /> Criar serviço</button></form>}
    <div className="panel"><div className="panel-heading"><div><p className="eyebrow">Tipos disponíveis</p><h2>Serviços</h2></div></div><div className="service-grid">{services.map((s) => <article className="service-card" key={s.id}><ClipboardList size={20} /><strong>{s.name}</strong><p>{s.description || 'Sem descrição.'}</p><span>{formatTime(s.default_start)} — {formatTime(s.default_end)}</span></article>)}</div></div>
  </section>
}

function SwapsPanel({ swaps, shifts, soldiers, isAdmin, mySoldierId, onChanged }: { swaps: SwapRequest[]; shifts: Shift[]; soldiers: Soldier[]; isAdmin: boolean; mySoldierId: string | null; onChanged: () => Promise<void> }) {
  const [shiftId, setShiftId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const eligible = shifts.filter((shift) => shift.soldier_id === mySoldierId && shift.service_date >= new Date().toISOString().slice(0, 10))

  async function requestSwap(event: FormEvent) {
    event.preventDefault()
    const { error } = await supabase.from('swap_requests').insert({ shift_id: shiftId, target_soldier_id: targetId || null, reason })
    if (error) return alert(error.message)
    setShiftId(''); setTargetId(''); setReason(''); await onChanged()
  }

  async function review(id: string, status: 'aprovada' | 'recusada') {
    const { error } = await supabase.from('swap_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
    if (error) return alert(error.message)
    await onChanged()
  }

  return <section className="content-stack">
    {!isAdmin && <form className="panel form-grid" onSubmit={requestSwap}><div className="panel-heading full"><div><p className="eyebrow">Solicitação</p><h2>Pedir troca de serviço</h2></div></div>{!mySoldierId ? <div className="notice full">Sua conta ainda não foi vinculada a um cadastro de militar. Solicite o vínculo ao administrador.</div> : <><label>Meu serviço<select value={shiftId} onChange={(e) => setShiftId(e.target.value)} required><option value="">Selecione</option>{eligible.map((s) => <option key={s.id} value={s.id}>{formatDate(s.service_date)} • {s.service_types?.name}</option>)}</select></label><label>Trocar com<select value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">A definir pelo administrador</option>{soldiers.filter((s) => s.id !== mySoldierId && s.active).map((s) => <option key={s.id} value={s.id}>{s.rank} {s.war_name || s.full_name}</option>)}</select></label><label className="wide">Motivo<textarea value={reason} onChange={(e) => setReason(e.target.value)} required /></label><button className="primary-button fit"><RefreshCw size={16} /> Enviar pedido</button></>}</form>}
    <div className="panel"><div className="panel-heading"><div><p className="eyebrow">Histórico</p><h2>{isAdmin ? 'Pedidos de troca' : 'Minhas solicitações'}</h2></div></div><div className="cards-list">{swaps.length === 0 ? <p className="muted">Nenhuma solicitação encontrada.</p> : swaps.map((swap) => { const shift = shifts.find((s) => s.id === swap.shift_id); const target = soldiers.find((s) => s.id === swap.target_soldier_id); return <article className="swap-row" key={swap.id}><div><strong>{shift ? `${formatDate(shift.service_date)} • ${shift.service_types?.name ?? 'Serviço'}` : 'Serviço'}</strong><span>{swap.reason}{target ? ` • Preferência: ${target.rank} ${target.war_name || target.full_name}` : ''}</span></div><span className={`status ${swap.status === 'aprovada' ? 'success' : swap.status === 'recusada' ? 'danger' : ''}`}>{swap.status}</span>{isAdmin && swap.status === 'pendente' && <div className="row-actions"><button className="small-button success-button" onClick={() => void review(swap.id, 'aprovada')}><CheckCircle2 size={14} /> Aprovar</button><button className="small-button" onClick={() => void review(swap.id, 'recusada')}>Recusar</button></div>}</article> })}</div></div>
  </section>
}

function ShiftTable({ shifts }: { shifts: Shift[] }) {
  if (shifts.length === 0) return <p className="muted">Nenhum serviço cadastrado.</p>
  return <div className="table-wrap"><table><thead><tr><th>Data</th><th>Militar</th><th>Serviço</th><th>Horário</th><th>Status</th></tr></thead><tbody>{shifts.map((shift) => <tr key={shift.id}><td>{formatDate(shift.service_date)}</td><td><strong>{shift.soldiers?.rank} {shift.soldiers?.war_name || shift.soldiers?.full_name}</strong></td><td>{shift.service_types?.name}</td><td>{formatTime(shift.start_time)} – {formatTime(shift.end_time)}</td><td><span className={shift.status === 'confirmado' || shift.status === 'concluido' ? 'status success' : 'status'}>{shift.status}</span></td></tr>)}</tbody></table></div>
}

function EmptyState({ title, text }: { title: string; text: string }) { return <div className="panel empty-state"><ShieldCheck size={32} /><h2>{title}</h2><p>{text}</p></div> }
function LoadingScreen() { return <div className="loading-screen"><ShieldCheck size={36} /><span>Carregando sistema...</span></div> }
function LoadingBlock() { return <div className="panel muted">Carregando dados...</div> }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }
function formatTime(value: string | null) { return value ? value.slice(0, 5) : '--:--' }

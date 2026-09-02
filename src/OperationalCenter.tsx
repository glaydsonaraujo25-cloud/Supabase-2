import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BellRing, CalendarRange, ChevronDown, ChevronUp, ClipboardEdit, History, RefreshCw, X } from 'lucide-react'
import { supabase } from './lib/supabase'

type Profile = { role: 'admin' | 'usuario'; soldier_id: string | null }
type Soldier = { id: string; full_name: string; rank: string; war_name: string | null; active: boolean }
type Service = { id: string; name: string; default_start: string | null; default_end: string | null }
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
type Swap = { id: string; shift_id: string; target_soldier_id: string | null; target_accepted: boolean | null; status: string; reason: string }
type Audit = { id: string; entity: string; action: string; record_id: string | null; details: Record<string, unknown>; created_at: string }
type Tab = 'alertas' | 'calendario' | 'editar' | 'auditoria'

const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export default function OperationalCenter() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('alertas')
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [swaps, setSwaps] = useState<Swap[]>([])
  const [audit, setAudit] = useState<Audit[]>([])
  const [loading, setLoading] = useState(false)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    let mounted = true
    async function boot() {
      const { data } = await supabase.auth.getUser()
      if (!data.user || !mounted) { if (mounted) setProfile(null); return }
      const { data: p } = await supabase.from('profiles').select('role, soldier_id').eq('id', data.user.id).single()
      if (mounted && p) setProfile(p as Profile)
    }
    void boot()
    const { data } = supabase.auth.onAuthStateChange(() => void boot())
    return () => { mounted = false; data.subscription.unsubscribe() }
  }, [])

  async function refresh() {
    if (!profile) return
    setLoading(true)
    const queries = [
      supabase.from('soldiers').select('id, full_name, rank, war_name, active').order('full_name'),
      supabase.from('service_types').select('id, name, default_start, default_end').eq('active', true).order('name'),
      supabase.from('shifts').select('id, soldier_id, service_type_id, service_date, start_time, end_time, status, notes, soldiers(full_name, rank, war_name), service_types(name)').order('service_date').order('start_time'),
      supabase.from('swap_requests').select('id, shift_id, target_soldier_id, target_accepted, status, reason').order('created_at', { ascending: false }),
    ] as const
    const [soldierResult, serviceResult, shiftResult, swapResult] = await Promise.all(queries)
    if (soldierResult.data) setSoldiers(soldierResult.data as Soldier[])
    if (serviceResult.data) setServices(serviceResult.data as Service[])
    if (shiftResult.data) setShifts(shiftResult.data as unknown as Shift[])
    if (swapResult.data) setSwaps(swapResult.data as Swap[])
    if (isAdmin) {
      const { data } = await supabase.from('audit_logs').select('id, entity, action, record_id, details, created_at').order('created_at', { ascending: false }).limit(100)
      if (data) setAudit(data as Audit[])
    }
    setLoading(false)
  }

  useEffect(() => { if (open && profile) void refresh() }, [open, profile?.role, profile?.soldier_id])

  if (!profile) return null

  return <div className="operational-center no-print">
    <button className="operational-trigger" onClick={() => setOpen((v) => !v)}>
      <BellRing size={17} /> Centro operacional {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
    </button>
    {open && <section className="operational-panel">
      <header className="operational-head"><div><strong>Centro operacional</strong><span>Calendário, alertas e controle da escala</span></div><div><button onClick={() => void refresh()} title="Atualizar"><RefreshCw size={16} /></button><button onClick={() => setOpen(false)} title="Fechar"><X size={17} /></button></div></header>
      <nav className="operational-tabs">
        <button className={tab === 'alertas' ? 'active' : ''} onClick={() => setTab('alertas')}><BellRing size={14} /> Alertas</button>
        <button className={tab === 'calendario' ? 'active' : ''} onClick={() => setTab('calendario')}><CalendarRange size={14} /> Calendário</button>
        {isAdmin && <button className={tab === 'editar' ? 'active' : ''} onClick={() => setTab('editar')}><ClipboardEdit size={14} /> Editar escala</button>}
        {isAdmin && <button className={tab === 'auditoria' ? 'active' : ''} onClick={() => setTab('auditoria')}><History size={14} /> Auditoria</button>}
      </nav>
      <div className="operational-body">{loading ? <p className="muted">Atualizando...</p> : <>
        {tab === 'alertas' && <Alerts profile={profile} shifts={shifts} swaps={swaps} />}
        {tab === 'calendario' && <CalendarView profile={profile} shifts={shifts} />}
        {tab === 'editar' && isAdmin && <ShiftEditor shifts={shifts} soldiers={soldiers} services={services} onDone={refresh} />}
        {tab === 'auditoria' && isAdmin && <AuditLog rows={audit} />}
      </>}</div>
    </section>}
  </div>
}

function Alerts({ profile, shifts, swaps }: { profile: Profile; shifts: Shift[]; swaps: Swap[] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const limit = new Date(today); limit.setDate(limit.getDate() + 7)
  const upcoming = shifts.filter((s) => {
    if (s.status === 'cancelado') return false
    if (profile.role !== 'admin' && s.soldier_id !== profile.soldier_id) return false
    const date = new Date(`${s.service_date}T12:00:00`)
    return date >= today && date <= limit
  })
  const awaiting = swaps.filter((s) => s.status === 'pendente' && s.target_soldier_id === profile.soldier_id && s.target_accepted === null)
  return <div className="operational-stack"><div><h3>Próximos 7 dias</h3>{upcoming.length === 0 ? <p className="muted">Nenhum serviço próximo.</p> : upcoming.map((s) => <article className="operational-alert" key={s.id}><strong>{formatDate(s.service_date)} • {s.service_types?.name || 'Serviço'}</strong><span>{s.soldiers ? `${s.soldiers.rank} ${s.soldiers.war_name || s.soldiers.full_name}` : 'Militar'} • {formatTime(s.start_time)}–{formatTime(s.end_time)}</span></article>)}</div>{profile.role !== 'admin' && <div><h3>Trocas aguardando sua resposta</h3>{awaiting.length === 0 ? <p className="muted">Nenhuma solicitação aguardando resposta.</p> : awaiting.map((s) => <article className="operational-alert warning" key={s.id}><strong>Solicitação de troca pendente</strong><span>{s.reason}</span></article>)}</div>}</div>
}

function CalendarView({ profile, shifts }: { profile: Profile; shifts: Shift[] }) {
  const [month, setMonth] = useState(monthKey())
  const [year, mon] = month.split('-').map(Number)
  const first = new Date(year, mon - 1, 1)
  const last = new Date(year, mon, 0)
  const days: (Date | null)[] = Array(first.getDay()).fill(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, mon - 1, d))
  while (days.length % 7) days.push(null)
  const visible = shifts.filter((s) => s.status !== 'cancelado' && s.service_date.startsWith(month) && (profile.role === 'admin' || s.soldier_id === profile.soldier_id))
  return <div><div className="calendar-toolbar"><div><h3>Calendário mensal</h3><p className="muted">{profile.role === 'admin' ? 'Escala geral' : 'Sua escala'}</p></div><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div><div className="month-grid"><div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>{days.map((day, index) => day ? <div className="month-day" key={dateKey(day)}><strong>{day.getDate()}</strong>{visible.filter((s) => s.service_date === dateKey(day)).map((s) => <span className="calendar-shift" key={s.id} title={`${s.soldiers?.rank || ''} ${s.soldiers?.war_name || s.soldiers?.full_name || ''}`}>{s.service_types?.name || 'Serviço'}<small>{formatTime(s.start_time)}</small></span>)}</div> : <div className="month-day empty" key={`empty-${index}`} />)}</div></div>
}

function ShiftEditor({ shifts, soldiers, services, onDone }: { shifts: Shift[]; soldiers: Soldier[]; services: Service[]; onDone: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState('')
  const selected = shifts.find((s) => s.id === selectedId) || null
  const [draft, setDraft] = useState<Shift | null>(null)
  useEffect(() => { setDraft(selected ? { ...selected } : null) }, [selectedId])

  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft) return
    const { error } = await supabase.from('shifts').update({ soldier_id: draft.soldier_id, service_type_id: draft.service_type_id, service_date: draft.service_date, start_time: draft.start_time, end_time: draft.end_time, status: draft.status, notes: draft.notes || null }).eq('id', draft.id)
    if (error) return alert(error.message)
    alert('Serviço atualizado com sucesso.')
    setSelectedId(''); setDraft(null); await onDone()
  }

  return <div><h3>Editar serviço escalado</h3><p className="muted">Altere militar, tipo de serviço, data, horário, status ou observação. As validações de conflito do banco continuam ativas.</p><label>Serviço<select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}><option value="">Selecione</option>{shifts.slice().sort((a, b) => b.service_date.localeCompare(a.service_date)).map((s) => <option key={s.id} value={s.id}>{formatDate(s.service_date)} • {s.service_types?.name || 'Serviço'} • {s.soldiers?.war_name || s.soldiers?.full_name || 'Militar'}</option>)}</select></label>{draft && <form className="operational-form" onSubmit={save}><div className="operational-two"><label>Militar<select value={draft.soldier_id} onChange={(e) => setDraft({ ...draft, soldier_id: e.target.value })}>{soldiers.filter((s) => s.active || s.id === draft.soldier_id).map((s) => <option key={s.id} value={s.id}>{s.rank} {s.war_name || s.full_name}</option>)}</select></label><label>Serviço<select value={draft.service_type_id} onChange={(e) => setDraft({ ...draft, service_type_id: e.target.value })}>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div><div className="operational-three"><label>Data<input type="date" value={draft.service_date} onChange={(e) => setDraft({ ...draft, service_date: e.target.value })} /></label><label>Início<input type="time" value={formatTime(draft.start_time)} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} /></label><label>Fim<input type="time" value={formatTime(draft.end_time)} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} /></label></div><label>Status<select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option value="planejado">Planejado</option><option value="confirmado">Confirmado</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option></select></label><label>Observação<textarea value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label><button className="primary-button fit">Salvar alterações</button></form>}</div>
}

function AuditLog({ rows }: { rows: Audit[] }) {
  return <div><h3>Histórico de alterações</h3><p className="muted">Últimas 100 alterações registradas no banco.</p><div className="audit-list">{rows.length === 0 ? <p className="muted">Nenhuma alteração registrada ainda.</p> : rows.map((row) => <article key={row.id}><div><strong>{entityLabel(row.entity)}</strong><span>{actionLabel(row.action)} • {new Date(row.created_at).toLocaleString('pt-BR')}</span></div><code>{row.record_id?.slice(0, 8) || '—'}</code></article>)}</div></div>
}

function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`)) }
function formatTime(value: string | null) { return value ? value.slice(0, 5) : '--:--' }
function entityLabel(value: string) { return ({ soldiers: 'Militares', service_types: 'Serviços', shifts: 'Escala', unavailabilities: 'Impedimentos', swap_requests: 'Trocas' } as Record<string, string>)[value] || value }
function actionLabel(value: string) { return ({ insert: 'Criado', update: 'Alterado', delete: 'Excluído' } as Record<string, string>)[value] || value }

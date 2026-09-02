import { useEffect, useMemo, useState } from 'react'
import { BellRing, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, X } from 'lucide-react'
import { supabase } from './lib/supabase'

type Profile = { id: string; full_name: string; role: 'admin' | 'usuario'; soldier_id: string | null; email?: string | null }
type Shift = {
  id: string
  soldier_id: string
  service_date: string
  start_time: string
  end_time: string
  status: string
  soldiers: { full_name: string; rank: string; war_name: string | null } | null
  service_types: { name: string } | null
}
type Ack = { id: string; shift_id: string; user_id: string; acknowledged_at: string }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

export default function ServiceAcknowledgements() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [acks, setAcks] = useState<Ack[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const today = new Date().toISOString().slice(0, 10)

  async function boot() {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('id, full_name, role, soldier_id, email').eq('id', auth.user.id).single()
    if (data) setProfile(data as Profile)
  }

  async function refresh() {
    if (!profile) return
    setLoading(true)
    const [shiftResult, ackResult] = await Promise.all([
      supabase.from('shifts').select('id, soldier_id, service_date, start_time, end_time, status, soldiers(full_name, rank, war_name), service_types(name)').gte('service_date', today).neq('status', 'cancelado').order('service_date').order('start_time'),
      supabase.from('service_acknowledgements').select('id, shift_id, user_id, acknowledged_at'),
    ])
    if (shiftResult.data) setShifts(shiftResult.data as unknown as Shift[])
    if (ackResult.data) setAcks(ackResult.data as Ack[])
    if (isAdmin) {
      const { data } = await supabase.from('profiles').select('id, full_name, role, soldier_id, email').order('full_name')
      if (data) setProfiles(data as Profile[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void boot()
    const { data } = supabase.auth.onAuthStateChange(() => void boot())
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (open && profile) void refresh() }, [open, profile?.id, isAdmin])

  const myShifts = useMemo(() => shifts.filter((s) => !!profile?.soldier_id && s.soldier_id === profile.soldier_id), [shifts, profile?.soldier_id])
  const pendingMine = myShifts.filter((s) => !acks.some((a) => a.shift_id === s.id && a.user_id === profile?.id)).length

  async function acknowledge(shiftId: string) {
    if (!profile) return
    const { error } = await supabase.from('service_acknowledgements').insert({ shift_id: shiftId, user_id: profile.id })
    if (error) return alert(error.message)
    await refresh()
  }

  if (!profile) return null

  return <div className="ack-center no-print">
    <button className="ack-trigger" onClick={() => setOpen((value) => !value)}>
      <BellRing size={17} /> {isAdmin ? 'Ciência de serviços' : `Minhas confirmações${pendingMine ? ` (${pendingMine})` : ''}`} {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
    </button>

    {open && <section className="ack-panel">
      <div className="ack-head">
        <div><strong>{isAdmin ? 'Acompanhamento de ciência' : 'Confirmar ciência da escala'}</strong><span>{isAdmin ? 'Veja quem já confirmou os próximos serviços.' : 'Marque que você visualizou cada serviço futuro.'}</span></div>
        <div className="ack-actions"><button onClick={() => void refresh()} title="Atualizar"><RefreshCw size={16} /></button><button onClick={() => setOpen(false)} title="Fechar"><X size={17} /></button></div>
      </div>

      <div className="ack-body">{loading ? <p className="muted">Atualizando...</p> : isAdmin ? <AdminView shifts={shifts} acks={acks} profiles={profiles} /> : <UserView shifts={myShifts} acks={acks} userId={profile.id} onAck={acknowledge} />}</div>
    </section>}
  </div>
}

function UserView({ shifts, acks, userId, onAck }: { shifts: Shift[]; acks: Ack[]; userId: string; onAck: (id: string) => Promise<void> }) {
  if (!shifts.length) return <p className="muted">Você não possui serviços futuros cadastrados.</p>
  return <div className="ack-list">{shifts.map((shift) => {
    const ack = acks.find((item) => item.shift_id === shift.id && item.user_id === userId)
    return <article className="ack-row" key={shift.id}><div><strong>{formatDate(shift.service_date)} • {shift.service_types?.name || 'Serviço'}</strong><span>{shift.soldiers?.rank} {shift.soldiers?.war_name || shift.soldiers?.full_name} • {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}</span></div>{ack ? <span className="ack-ok"><CheckCircle2 size={14} /> Confirmado</span> : <button className="small-button success-button" onClick={() => void onAck(shift.id)}><CheckCircle2 size={14} /> Confirmar ciência</button>}</article>
  })}</div>
}

function AdminView({ shifts, acks, profiles }: { shifts: Shift[]; acks: Ack[]; profiles: Profile[] }) {
  if (!shifts.length) return <p className="muted">Nenhum serviço futuro cadastrado.</p>
  return <div className="ack-list">{shifts.map((shift) => {
    const assignedProfile = profiles.find((p) => p.soldier_id === shift.soldier_id)
    const ack = assignedProfile ? acks.find((item) => item.shift_id === shift.id && item.user_id === assignedProfile.id) : undefined
    return <article className="ack-row" key={shift.id}><div><strong>{formatDate(shift.service_date)} • {shift.service_types?.name || 'Serviço'}</strong><span>{shift.soldiers?.rank} {shift.soldiers?.war_name || shift.soldiers?.full_name}{assignedProfile?.email ? ` • ${assignedProfile.email}` : ''}</span></div>{!assignedProfile ? <span className="ack-warning">Conta não vinculada</span> : ack ? <span className="ack-ok"><CheckCircle2 size={14} /> Ciência confirmada</span> : <span className="ack-pending">Aguardando ciência</span>}</article>
  })}</div>
}

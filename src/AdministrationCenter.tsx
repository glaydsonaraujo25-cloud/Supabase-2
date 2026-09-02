import { useEffect, useMemo, useState } from 'react'
import { ArchiveRestore, DatabaseBackup, ShieldCheck, UserCog, X } from 'lucide-react'
import { supabase } from './lib/supabase'

type Profile = { id: string; full_name: string; email: string | null; role: 'admin' | 'usuario'; soldier_id: string | null }
type Soldier = { id: string; full_name: string; rank: string; war_name: string | null; active: boolean }
type Service = { id: string; name: string; description: string | null; default_start: string | null; default_end: string | null; active: boolean }
type Tab = 'usuarios' | 'servicos' | 'exportar'

export default function AdministrationCenter() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('usuarios')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return setIsAdmin(false)
      const { data } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
      setIsAdmin(data?.role === 'admin')
    }
    void check()
    const { data } = supabase.auth.onAuthStateChange(() => void check())
    return () => data.subscription.unsubscribe()
  }, [])

  async function refresh() {
    if (!isAdmin) return
    setLoading(true)
    const [p, s, t] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, soldier_id').order('full_name'),
      supabase.from('soldiers').select('id, full_name, rank, war_name, active').order('full_name'),
      supabase.from('service_types').select('id, name, description, default_start, default_end, active').order('name'),
    ])
    if (p.data) setProfiles(p.data as Profile[])
    if (s.data) setSoldiers(s.data as Soldier[])
    if (t.data) setServices(t.data as Service[])
    setLoading(false)
  }

  useEffect(() => { if (open && isAdmin) void refresh() }, [open, isAdmin])

  if (!isAdmin) return null

  return <div className="admin-center no-print">
    <button className="admin-center-trigger" onClick={() => setOpen(true)}><ShieldCheck size={17} /> Administração</button>
    {open && <div className="admin-center-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className="admin-center-panel">
        <header className="admin-center-head"><div><strong>Central de Administração</strong><span>Usuários, acessos, serviços inativos e exportação</span></div><button onClick={() => setOpen(false)}><X size={18} /></button></header>
        <div className="admin-center-tabs">
          <button className={tab === 'usuarios' ? 'active' : ''} onClick={() => setTab('usuarios')}><UserCog size={15} /> Usuários</button>
          <button className={tab === 'servicos' ? 'active' : ''} onClick={() => setTab('servicos')}><ArchiveRestore size={15} /> Serviços inativos</button>
          <button className={tab === 'exportar' ? 'active' : ''} onClick={() => setTab('exportar')}><DatabaseBackup size={15} /> Exportar dados</button>
        </div>
        <div className="admin-center-body">{loading ? <p className="muted">Carregando...</p> : <>
          {tab === 'usuarios' && <UsersManager profiles={profiles} soldiers={soldiers} onDone={refresh} />}
          {tab === 'servicos' && <InactiveServices services={services} onDone={refresh} />}
          {tab === 'exportar' && <DataExport />}
        </>}</div>
      </section>
    </div>}
  </div>
}

function UsersManager({ profiles, soldiers, onDone }: { profiles: Profile[]; soldiers: Soldier[]; onDone: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [role, setRole] = useState<'admin' | 'usuario'>('usuario')
  const [soldierId, setSoldierId] = useState('')
  const linkedIds = useMemo(() => new Set(profiles.filter((p) => p.soldier_id).map((p) => p.soldier_id as string)), [profiles])

  function start(profile: Profile) { setEditingId(profile.id); setRole(profile.role); setSoldierId(profile.soldier_id || '') }

  async function save() {
    if (!editingId) return
    const { error } = await supabase.from('profiles').update({ role, soldier_id: soldierId || null }).eq('id', editingId)
    if (error) return alert(error.message)
    setEditingId(null)
    await onDone()
  }

  return <div><div className="admin-section-title"><div><h3>Usuários e permissões</h3><p>Promova administradores e vincule cada conta ao cadastro correto de militar.</p></div><span>{profiles.length} conta(s)</span></div><div className="admin-user-list">{profiles.map((profile) => {
    const soldier = soldiers.find((s) => s.id === profile.soldier_id)
    const editing = editingId === profile.id
    return <article className="admin-user-row" key={profile.id}>
      <div className="admin-user-info"><strong>{profile.full_name || 'Sem nome'}</strong><span>{profile.email || 'E-mail não disponível'}</span><small>{soldier ? `${soldier.rank} ${soldier.war_name || soldier.full_name}` : 'Conta sem vínculo militar'} • {profile.role === 'admin' ? 'Administrador' : 'Usuário'}</small></div>
      {editing ? <div className="admin-user-editor"><select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'usuario')}><option value="usuario">Usuário</option><option value="admin">Administrador</option></select><select value={soldierId} onChange={(e) => setSoldierId(e.target.value)}><option value="">Sem vínculo</option>{soldiers.filter((s) => s.active && (!linkedIds.has(s.id) || s.id === profile.soldier_id)).map((s) => <option value={s.id} key={s.id}>{s.rank} {s.war_name || s.full_name}</option>)}</select><button className="small-button success-button" onClick={() => void save()}>Salvar</button><button className="small-button" onClick={() => setEditingId(null)}>Cancelar</button></div> : <button className="small-button" onClick={() => start(profile)}>Gerenciar</button>}
    </article>
  })}</div></div>
}

function InactiveServices({ services, onDone }: { services: Service[]; onDone: () => Promise<void> }) {
  const inactive = services.filter((s) => !s.active)
  async function restore(id: string) {
    const { error } = await supabase.from('service_types').update({ active: true }).eq('id', id)
    if (error) return alert(error.message)
    await onDone()
  }
  return <div><div className="admin-section-title"><div><h3>Serviços inativos</h3><p>Recupere um tipo de serviço que foi desativado sem perder o histórico.</p></div><span>{inactive.length} inativo(s)</span></div>{inactive.length === 0 ? <div className="admin-empty">Nenhum serviço inativo.</div> : <div className="admin-user-list">{inactive.map((service) => <article className="admin-user-row" key={service.id}><div className="admin-user-info"><strong>{service.name}</strong><span>{service.description || 'Sem descrição'}</span><small>{(service.default_start || '--:--').slice(0,5)} — {(service.default_end || '--:--').slice(0,5)}</small></div><button className="small-button success-button" onClick={() => void restore(service.id)}><ArchiveRestore size={14} /> Reativar</button></article>)}</div>}</div>
}

function DataExport() {
  const [busy, setBusy] = useState(false)
  async function exportData() {
    setBusy(true)
    const tables = ['profiles', 'soldiers', 'service_types', 'shifts', 'unavailabilities', 'swap_requests', 'audit_logs'] as const
    const output: Record<string, unknown> = { exported_at: new Date().toISOString() }
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*')
      output[table] = error ? { error: error.message } : data
    }
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `escala-servico-backup-${new Date().toISOString().slice(0,10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setBusy(false)
  }
  return <div className="admin-export-card"><DatabaseBackup size={34} /><h3>Exportação administrativa</h3><p>Gera um arquivo JSON com os dados que sua conta administrativa tem permissão para consultar. Não inclui senhas, tokens ou chaves do Supabase.</p><button className="primary-button fit" disabled={busy} onClick={() => void exportData()}>{busy ? 'Preparando...' : 'Exportar dados'}</button></div>
}

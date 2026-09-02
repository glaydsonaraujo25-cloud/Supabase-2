import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarPlus, ChevronDown, ChevronUp, Pencil, RefreshCw, UserCog, X } from 'lucide-react'
import { supabase } from './lib/supabase'

type Soldier = { id: string; full_name: string; rank: string; war_name: string | null; organization: string | null; active: boolean }
type Service = { id: string; name: string; default_start: string | null; default_end: string | null }
type Shift = { id: string; soldier_id: string; service_type_id: string; service_date: string; status: string }
type Block = { id: string; soldier_id: string; type: string; start_date: string; end_date: string; reason: string | null }
type ToolTab = 'gerador' | 'militares' | 'impedimentos' | 'relatorios'

function toIso(date: Date) { return date.toISOString().slice(0, 10) }
function daysBetween(start: string, end: string) {
  const dates: string[] = []
  const cursor = new Date(`${start}T12:00:00`)
  const finish = new Date(`${end}T12:00:00`)
  while (cursor <= finish) { dates.push(toIso(cursor)); cursor.setDate(cursor.getDate() + 1) }
  return dates
}

export default function AdminToolkit() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ToolTab>('gerador')
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    async function boot() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user || !mounted) return
      const { data } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
      if (mounted) setIsAdmin(data?.role === 'admin')
    }
    void boot()
    const { data } = supabase.auth.onAuthStateChange(() => void boot())
    return () => { mounted = false; data.subscription.unsubscribe() }
  }, [])

  async function refresh() {
    if (!isAdmin) return
    setLoading(true)
    const [s, t, h, b] = await Promise.all([
      supabase.from('soldiers').select('id, full_name, rank, war_name, organization, active').order('full_name'),
      supabase.from('service_types').select('id, name, default_start, default_end').eq('active', true).order('name'),
      supabase.from('shifts').select('id, soldier_id, service_type_id, service_date, status'),
      supabase.from('unavailabilities').select('id, soldier_id, type, start_date, end_date, reason').order('start_date'),
    ])
    if (s.data) setSoldiers(s.data as Soldier[])
    if (t.data) setServices(t.data as Service[])
    if (h.data) setShifts(h.data as Shift[])
    if (b.data) setBlocks(b.data as Block[])
    setLoading(false)
  }

  useEffect(() => { if (open && isAdmin) void refresh() }, [open, isAdmin])

  if (!isAdmin) return null

  return <div className="admin-toolkit no-print">
    <button className="toolkit-trigger" onClick={() => setOpen((value) => !value)}>
      <UserCog size={17} /> Ferramentas admin {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
    </button>
    {open && <section className="toolkit-panel">
      <div className="toolkit-head"><div><strong>Ferramentas administrativas</strong><span>Relatórios, cadastros e geração assistida</span></div><div className="toolkit-head-actions"><button onClick={() => void refresh()} title="Atualizar"><RefreshCw size={16} /></button><button onClick={() => setOpen(false)} title="Fechar"><X size={17} /></button></div></div>
      <div className="toolkit-tabs">
        <button className={tab === 'gerador' ? 'active' : ''} onClick={() => setTab('gerador')}><CalendarPlus size={15} /> Gerador</button>
        <button className={tab === 'militares' ? 'active' : ''} onClick={() => setTab('militares')}><UserCog size={15} /> Militares</button>
        <button className={tab === 'impedimentos' ? 'active' : ''} onClick={() => setTab('impedimentos')}><Pencil size={15} /> Impedimentos</button>
        <button className={tab === 'relatorios' ? 'active' : ''} onClick={() => setTab('relatorios')}><BarChart3 size={15} /> Relatórios</button>
      </div>
      <div className="toolkit-body">{loading ? <p className="muted">Atualizando dados...</p> : <>
        {tab === 'gerador' && <Generator soldiers={soldiers} services={services} shifts={shifts} blocks={blocks} onDone={refresh} />}
        {tab === 'militares' && <SoldierManager soldiers={soldiers} onDone={refresh} />}
        {tab === 'impedimentos' && <BlockManager blocks={blocks} soldiers={soldiers} onDone={refresh} />}
        {tab === 'relatorios' && <Reports soldiers={soldiers} services={services} shifts={shifts} blocks={blocks} />}
      </>}</div>
    </section>}
  </div>
}

function Generator({ soldiers, services, shifts, blocks, onDone }: { soldiers: Soldier[]; services: Service[]; shifts: Shift[]; blocks: Block[]; onDone: () => Promise<void> }) {
  const [serviceId, setServiceId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  async function generate(event: FormEvent) {
    event.preventDefault()
    const service = services.find((item) => item.id === serviceId)
    if (!service || !startDate || !endDate) return
    const active = soldiers.filter((item) => item.active)
    if (!active.length) return setResult('Não há militares ativos para distribuir.')
    const dates = daysBetween(startDate, endDate)
    if (dates.length > 62) return setResult('Use um intervalo de até 62 dias por geração.')

    const counts = new Map<string, number>()
    active.forEach((soldier) => counts.set(soldier.id, shifts.filter((shift) => shift.soldier_id === soldier.id && shift.status !== 'cancelado').length))
    const planned: { soldier_id: string; service_type_id: string; service_date: string; start_time: string; end_time: string; notes: string }[] = []
    const skipped: string[] = []

    for (const date of dates) {
      const candidates = active.filter((soldier) => {
        const unavailable = blocks.some((block) => block.soldier_id === soldier.id && date >= block.start_date && date <= block.end_date)
        const alreadyScheduled = shifts.some((shift) => shift.soldier_id === soldier.id && shift.service_date === date && shift.status !== 'cancelado') || planned.some((shift) => shift.soldier_id === soldier.id && shift.service_date === date)
        return !unavailable && !alreadyScheduled
      }).sort((a, b) => (counts.get(a.id) || 0) - (counts.get(b.id) || 0) || a.full_name.localeCompare(b.full_name))

      const selected = candidates[0]
      if (!selected) { skipped.push(date); continue }
      planned.push({ soldier_id: selected.id, service_type_id: service.id, service_date: date, start_time: (service.default_start || '08:00').slice(0, 5), end_time: (service.default_end || '08:00').slice(0, 5), notes: 'Gerado de forma semiautomática pelo sistema' })
      counts.set(selected.id, (counts.get(selected.id) || 0) + 1)
    }

    if (!planned.length) return setResult('Nenhuma escala pôde ser criada para o período selecionado.')
    const ok = confirm(`Serão criados ${planned.length} serviço(s).${skipped.length ? ` ${skipped.length} dia(s) ficaram sem candidato disponível.` : ''} Confirmar?`)
    if (!ok) return
    setBusy(true)
    const { error } = await supabase.from('shifts').insert(planned)
    setBusy(false)
    if (error) return setResult(`Erro: ${error.message}`)
    setResult(`${planned.length} serviço(s) criados.${skipped.length ? ` Dias sem candidato: ${skipped.join(', ')}.` : ''}`)
    await onDone()
  }

  return <form className="toolkit-form" onSubmit={generate}>
    <h3>Gerador semiautomático</h3><p>Distribui um serviço pelo período selecionado priorizando quem possui menor quantidade de serviços e ignorando militares impedidos ou já escalados no dia.</p>
    <label>Tipo de serviço<select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required><option value="">Selecione</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <div className="toolkit-two"><label>Data inicial<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></label><label>Data final<input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></label></div>
    <button className="primary-button fit" disabled={busy}>{busy ? 'Gerando...' : 'Gerar escala'}</button>{result && <div className="notice">{result}</div>}
  </form>
}

function SoldierManager({ soldiers, onDone }: { soldiers: Soldier[]; onDone: () => Promise<void> }) {
  const [editing, setEditing] = useState<Soldier | null>(null)
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editing) return
    const { error } = await supabase.from('soldiers').update({ full_name: editing.full_name, rank: editing.rank, war_name: editing.war_name || null, organization: editing.organization || null, active: editing.active }).eq('id', editing.id)
    if (error) return alert(error.message)
    setEditing(null); await onDone()
  }
  return <div><h3>Editar militares</h3><div className="toolkit-list">{soldiers.map((s) => <div className="toolkit-row" key={s.id}><div><strong>{s.rank} {s.war_name || s.full_name}</strong><span>{s.organization || 'Sem seção'} • {s.active ? 'Ativo' : 'Inativo'}</span></div><button className="small-button" onClick={() => setEditing({ ...s })}><Pencil size={14} /> Editar</button></div>)}</div>{editing && <form className="toolkit-edit" onSubmit={save}><h4>Alterar militar</h4><label>Nome<input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} required /></label><div className="toolkit-two"><label>Posto/graduação<input value={editing.rank} onChange={(e) => setEditing({ ...editing, rank: e.target.value })} required /></label><label>Nome de guerra<input value={editing.war_name || ''} onChange={(e) => setEditing({ ...editing, war_name: e.target.value })} /></label></div><label>Organização/Seção<input value={editing.organization || ''} onChange={(e) => setEditing({ ...editing, organization: e.target.value })} /></label><label className="toolkit-check"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Militar ativo</label><div className="row-actions"><button className="primary-button fit">Salvar</button><button type="button" className="small-button" onClick={() => setEditing(null)}>Cancelar</button></div></form>}</div>
}

function BlockManager({ blocks, soldiers, onDone }: { blocks: Block[]; soldiers: Soldier[]; onDone: () => Promise<void> }) {
  const [editing, setEditing] = useState<Block | null>(null)
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editing) return
    const { error } = await supabase.from('unavailabilities').update({ type: editing.type, start_date: editing.start_date, end_date: editing.end_date, reason: editing.reason || null }).eq('id', editing.id)
    if (error) return alert(error.message)
    setEditing(null); await onDone()
  }
  return <div><h3>Editar impedimentos</h3><div className="toolkit-list">{blocks.map((b) => { const s = soldiers.find((item) => item.id === b.soldier_id); return <div className="toolkit-row" key={b.id}><div><strong>{s ? `${s.rank} ${s.war_name || s.full_name}` : 'Militar'}</strong><span>{b.type} • {b.start_date} até {b.end_date}</span></div><button className="small-button" onClick={() => setEditing({ ...b })}><Pencil size={14} /> Editar</button></div> })}</div>{editing && <form className="toolkit-edit" onSubmit={save}><h4>Alterar impedimento</h4><label>Tipo<select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}><option value="ferias">Férias</option><option value="missao">Missão</option><option value="curso">Curso</option><option value="afastamento">Afastamento</option><option value="dispensa">Dispensa</option><option value="outro">Outro</option></select></label><div className="toolkit-two"><label>Início<input type="date" value={editing.start_date} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} /></label><label>Fim<input type="date" min={editing.start_date} value={editing.end_date} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} /></label></div><label>Observação<input value={editing.reason || ''} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} /></label><div className="row-actions"><button className="primary-button fit">Salvar</button><button type="button" className="small-button" onClick={() => setEditing(null)}>Cancelar</button></div></form>}</div>
}

function Reports({ soldiers, services, shifts, blocks }: { soldiers: Soldier[]; services: Service[]; shifts: Shift[]; blocks: Block[] }) {
  const valid = shifts.filter((s) => s.status !== 'cancelado')
  const bySoldier = useMemo(() => soldiers.map((soldier) => ({ soldier, total: valid.filter((s) => s.soldier_id === soldier.id).length })).sort((a, b) => b.total - a.total), [soldiers, valid])
  const byService = useMemo(() => services.map((service) => ({ service, total: valid.filter((s) => s.service_type_id === service.id).length })).sort((a, b) => b.total - a.total), [services, valid])
  function exportCsv() {
    const rows = [['Militar', 'Total de serviços'], ...bySoldier.map(({ soldier, total }) => [`${soldier.rank} ${soldier.war_name || soldier.full_name}`, String(total)])]
    const csv = rows.map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'relatorio-carga-servicos.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return <div><div className="toolkit-report-head"><div><h3>Relatórios rápidos</h3><p>Resumo com base nos serviços não cancelados.</p></div><button className="small-button" onClick={exportCsv}>Exportar CSV</button></div><div className="toolkit-metrics"><article><span>Serviços válidos</span><strong>{valid.length}</strong></article><article><span>Militares ativos</span><strong>{soldiers.filter((s) => s.active).length}</strong></article><article><span>Impedimentos</span><strong>{blocks.length}</strong></article></div><h4>Carga por militar</h4><div className="toolkit-bars">{bySoldier.slice(0, 12).map(({ soldier, total }) => <div key={soldier.id}><span>{soldier.rank} {soldier.war_name || soldier.full_name}</span><strong>{total}</strong></div>)}</div><h4>Serviços por tipo</h4><div className="toolkit-bars">{byService.map(({ service, total }) => <div key={service.id}><span>{service.name}</span><strong>{total}</strong></div>)}</div></div>
}

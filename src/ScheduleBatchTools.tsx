import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, CheckSquare, ChevronDown, ChevronUp, Copy, RefreshCw, Square, X } from 'lucide-react'
import { supabase } from './lib/supabase'

type Soldier = { id: string; full_name: string; rank: string; war_name: string | null; active: boolean }
type Service = { id: string; name: string }
type Shift = {
  id: string
  soldier_id: string
  service_type_id: string
  service_date: string
  start_time: string
  end_time: string
  status: string
  notes: string | null
}
type Block = { soldier_id: string; start_date: string; end_date: string }
type PreviewRow = Shift & { targetDate: string; valid: boolean; reason?: string }
type BatchTab = 'duplicar' | 'cancelar'

function dateAtNoon(value: string) { return new Date(`${value}T12:00:00`) }
function iso(date: Date) { return date.toISOString().slice(0, 10) }
function addDays(value: string, days: number) { const date = dateAtNoon(value); date.setDate(date.getDate() + days); return iso(date) }
function diffDays(a: string, b: string) { return Math.round((dateAtNoon(b).getTime() - dateAtNoon(a).getTime()) / 86400000) }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR').format(dateAtNoon(value)) }

export default function ScheduleBatchTools() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<BatchTab>('duplicar')
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(false)

  async function boot() {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return setIsAdmin(false)
    const { data } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
    setIsAdmin(data?.role === 'admin')
  }

  async function refresh() {
    if (!isAdmin) return
    setLoading(true)
    const [soldierResult, serviceResult, shiftResult, blockResult] = await Promise.all([
      supabase.from('soldiers').select('id, full_name, rank, war_name, active').order('full_name'),
      supabase.from('service_types').select('id, name').order('name'),
      supabase.from('shifts').select('id, soldier_id, service_type_id, service_date, start_time, end_time, status, notes').order('service_date'),
      supabase.from('unavailabilities').select('soldier_id, start_date, end_date'),
    ])
    if (soldierResult.data) setSoldiers(soldierResult.data as Soldier[])
    if (serviceResult.data) setServices(serviceResult.data as Service[])
    if (shiftResult.data) setShifts(shiftResult.data as Shift[])
    if (blockResult.data) setBlocks(blockResult.data as Block[])
    setLoading(false)
  }

  useEffect(() => {
    void boot()
    const { data } = supabase.auth.onAuthStateChange(() => void boot())
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (open && isAdmin) void refresh() }, [open, isAdmin])

  if (!isAdmin) return null

  return <div className="batch-tools no-print">
    <button className="batch-trigger" onClick={() => setOpen((value) => !value)}>
      <CalendarRange size={17} /> Escala em lote {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
    </button>
    {open && <section className="batch-panel">
      <div className="batch-head">
        <div><strong>Gestão de escala em lote</strong><span>Duplique períodos e cancele vários serviços com segurança.</span></div>
        <div className="batch-head-actions"><button onClick={() => void refresh()} title="Atualizar"><RefreshCw size={16} /></button><button onClick={() => setOpen(false)} title="Fechar"><X size={17} /></button></div>
      </div>
      <div className="batch-tabs"><button className={tab === 'duplicar' ? 'active' : ''} onClick={() => setTab('duplicar')}><Copy size={15} /> Duplicar período</button><button className={tab === 'cancelar' ? 'active' : ''} onClick={() => setTab('cancelar')}><CheckSquare size={15} /> Cancelar em lote</button></div>
      <div className="batch-body">{loading ? <p className="muted">Atualizando dados...</p> : tab === 'duplicar' ? <DuplicateRange soldiers={soldiers} services={services} shifts={shifts} blocks={blocks} onDone={refresh} /> : <BulkCancel soldiers={soldiers} services={services} shifts={shifts} onDone={refresh} />}</div>
    </section>}
  </div>
}

function DuplicateRange({ soldiers, services, shifts, blocks, onDone }: { soldiers: Soldier[]; services: Service[]; shifts: Shift[]; blocks: Block[]; onDone: () => Promise<void> }) {
  const [sourceStart, setSourceStart] = useState('')
  const [sourceEnd, setSourceEnd] = useState('')
  const [targetStart, setTargetStart] = useState('')
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function buildPreview() {
    setMessage('')
    if (!sourceStart || !sourceEnd || !targetStart) return setMessage('Informe o período de origem e a data inicial do novo período.')
    const length = diffDays(sourceStart, sourceEnd)
    if (length < 0) return setMessage('A data final não pode ser anterior à data inicial.')
    if (length > 30) return setMessage('Duplique no máximo 31 dias por vez.')

    const source = shifts.filter((shift) => shift.service_date >= sourceStart && shift.service_date <= sourceEnd && shift.status !== 'cancelado')
    if (!source.length) { setPreview([]); return setMessage('Nenhum serviço ativo foi encontrado no período de origem.') }

    const rows = source.map((shift) => {
      const offset = diffDays(sourceStart, shift.service_date)
      const targetDate = addDays(targetStart, offset)
      const soldier = soldiers.find((item) => item.id === shift.soldier_id)
      if (!soldier?.active) return { ...shift, targetDate, valid: false, reason: 'Militar inativo' }
      const blocked = blocks.some((block) => block.soldier_id === shift.soldier_id && targetDate >= block.start_date && targetDate <= block.end_date)
      if (blocked) return { ...shift, targetDate, valid: false, reason: 'Militar impedido na nova data' }
      const conflict = shifts.some((item) => item.soldier_id === shift.soldier_id && item.service_date === targetDate && item.status !== 'cancelado')
      if (conflict) return { ...shift, targetDate, valid: false, reason: 'Já existe serviço para o militar neste dia' }
      return { ...shift, targetDate, valid: true }
    })
    setPreview(rows)
  }

  async function duplicate() {
    const valid = preview.filter((row) => row.valid)
    if (!valid.length) return setMessage('Não há itens livres de conflito para criar.')
    if (!confirm(`Criar ${valid.length} serviço(s)? ${preview.length - valid.length} item(ns) com conflito serão ignorados.`)) return
    setBusy(true); setMessage('')
    const payload = valid.map((row) => ({ soldier_id: row.soldier_id, service_type_id: row.service_type_id, service_date: row.targetDate, start_time: row.start_time, end_time: row.end_time, status: row.status === 'concluido' ? 'planejado' : row.status, notes: row.notes ? `${row.notes} • Período duplicado` : 'Período duplicado' }))
    const { error } = await supabase.from('shifts').insert(payload)
    setBusy(false)
    if (error) return setMessage(`Não foi possível duplicar: ${error.message}`)
    setMessage(`${payload.length} serviço(s) criados com sucesso.`); setPreview([]); await onDone()
  }

  const validCount = preview.filter((row) => row.valid).length
  return <div>
    <h3>Duplicar período da escala</h3><p className="muted">Use uma escala existente como base para outro período. Conflitos e impedimentos são ignorados antes da gravação.</p>
    <div className="batch-form-grid"><label>Origem: início<input type="date" value={sourceStart} onChange={(e) => { setSourceStart(e.target.value); setPreview([]) }} /></label><label>Origem: fim<input type="date" min={sourceStart} value={sourceEnd} onChange={(e) => { setSourceEnd(e.target.value); setPreview([]) }} /></label><label>Novo período começa em<input type="date" value={targetStart} onChange={(e) => { setTargetStart(e.target.value); setPreview([]) }} /></label></div>
    <div className="row-actions"><button className="secondary-button" onClick={buildPreview}><Copy size={15} /> Visualizar antes</button>{preview.length > 0 && <button className="primary-button" disabled={busy || validCount === 0} onClick={() => void duplicate()}>{busy ? 'Criando...' : `Criar ${validCount} serviço(s)`}</button>}</div>
    {message && <div className="notice batch-notice">{message}</div>}
    {preview.length > 0 && <><div className="batch-summary"><strong>{validCount} prontos para criar</strong><span>{preview.length - validCount} ignorados por conflito</span></div><div className="batch-preview">{preview.map((row) => { const soldier = soldiers.find((item) => item.id === row.soldier_id); const service = services.find((item) => item.id === row.service_type_id); return <div className={row.valid ? 'batch-preview-row valid' : 'batch-preview-row conflict'} key={`${row.id}-${row.targetDate}`}><div><strong>{formatDate(row.targetDate)} • {service?.name || 'Serviço'}</strong><span>{soldier ? `${soldier.rank} ${soldier.war_name || soldier.full_name}` : 'Militar'}</span></div><span>{row.valid ? 'Pronto' : row.reason}</span></div> })}</div></>}
  </div>
}

function BulkCancel({ soldiers, services, shifts, onDone }: { soldiers: Soldier[]; services: Service[]; shifts: Shift[]; onDone: () => Promise<void> }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [soldierId, setSoldierId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const filtered = useMemo(() => shifts.filter((shift) => shift.status !== 'cancelado' && (!start || shift.service_date >= start) && (!end || shift.service_date <= end) && (!soldierId || shift.soldier_id === soldierId) && (!serviceId || shift.service_type_id === serviceId)), [shifts, start, end, soldierId, serviceId])
  const allSelected = filtered.length > 0 && filtered.every((shift) => selected.includes(shift.id))

  function toggleAll() { setSelected(allSelected ? selected.filter((id) => !filtered.some((shift) => shift.id === id)) : Array.from(new Set([...selected, ...filtered.map((shift) => shift.id)]))) }
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }

  async function cancelSelected() {
    const ids = selected.filter((id) => filtered.some((shift) => shift.id === id))
    if (!ids.length) return setMessage('Selecione pelo menos um serviço.')
    if (!confirm(`Cancelar ${ids.length} serviço(s) selecionados? O histórico será preservado.`)) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from('shifts').update({ status: 'cancelado' }).in('id', ids)
    setBusy(false)
    if (error) return setMessage(`Não foi possível cancelar: ${error.message}`)
    setSelected([]); setMessage(`${ids.length} serviço(s) cancelados. O histórico foi mantido.`); await onDone()
  }

  return <div>
    <h3>Cancelar serviços em lote</h3><p className="muted">Filtre o período, selecione os registros desejados e cancele sem apagar o histórico.</p>
    <div className="batch-form-grid"><label>Data inicial<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>Data final<input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></label><label>Militar<select value={soldierId} onChange={(e) => setSoldierId(e.target.value)}><option value="">Todos</option>{soldiers.map((s) => <option key={s.id} value={s.id}>{s.rank} {s.war_name || s.full_name}</option>)}</select></label><label>Serviço<select value={serviceId} onChange={(e) => setServiceId(e.target.value)}><option value="">Todos</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
    <div className="batch-selectbar"><button className="small-button" onClick={toggleAll}>{allSelected ? <CheckSquare size={15} /> : <Square size={15} />} {allSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button><span>{filtered.length} registro(s) • {selected.filter((id) => filtered.some((shift) => shift.id === id)).length} selecionado(s)</span></div>
    <div className="batch-preview">{filtered.slice(0, 100).map((shift) => { const soldier = soldiers.find((item) => item.id === shift.soldier_id); const service = services.find((item) => item.id === shift.service_type_id); const checked = selected.includes(shift.id); return <button className={checked ? 'batch-cancel-row selected' : 'batch-cancel-row'} key={shift.id} onClick={() => toggle(shift.id)}><span>{checked ? <CheckSquare size={16} /> : <Square size={16} />}</span><div><strong>{formatDate(shift.service_date)} • {service?.name || 'Serviço'}</strong><span>{soldier ? `${soldier.rank} ${soldier.war_name || soldier.full_name}` : 'Militar'} • {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}</span></div></button> })}{filtered.length > 100 && <p className="muted">Mostrando os primeiros 100 registros. Refine os filtros para reduzir a lista.</p>}</div>
    <div className="row-actions batch-bottom-actions"><button className="danger-button" disabled={busy || !selected.some((id) => filtered.some((shift) => shift.id === id))} onClick={() => void cancelSelected()}>{busy ? 'Cancelando...' : 'Cancelar selecionados'}</button></div>{message && <div className="notice batch-notice">{message}</div>}
  </div>
}

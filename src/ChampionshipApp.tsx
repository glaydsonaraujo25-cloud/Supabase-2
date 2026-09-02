import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CalendarDays, CheckCircle2, ChevronRight, CircleUserRound, KeyRound, LayoutDashboard, LogOut, Medal, Pencil, Plus, RefreshCw, Swords, Trash2, Trophy, UserPlus, Users } from 'lucide-react'
import { siteUrl, supabase } from './lib/supabase'

type Championship = { id:string; owner_id:string; name:string; sport:string; format:'Pontos corridos'|'Mata-mata'|'Grupos + mata-mata'; status:'rascunho'|'aberto'|'em_andamento'|'finalizado'; start_date:string|null; end_date:string|null; max_teams:number; created_at:string; updated_at:string }
type Team = { id:string; championship_id:string; name:string; short_name:string|null; city:string|null; created_at:string }
type Player = { id:string; team_id:string; name:string; shirt_number:number|null; position:string|null; created_at:string }
type Match = { id:string; championship_id:string; home_team_id:string; away_team_id:string; round:number; scheduled_at:string|null; status:'agendado'|'em_andamento'|'finalizado'|'cancelado'; home_score:number|null; away_score:number|null; created_at:string }
type Profile = { id:string; full_name:string; email?:string|null }
type Tab = 'inicio'|'campeonatos'|'times'|'partidas'|'classificacao'
type Standing = { team:Team; points:number; played:number; wins:number; draws:number; losses:number; goalsFor:number; goalsAgainst:number; goalDiff:number }

const nav = [
  ['inicio','Visão geral',LayoutDashboard],['campeonatos','Campeonatos',Trophy],['times','Times e jogadores',Users],['partidas','Partidas',Swords],['classificacao','Classificação',Medal]
] as const

export default function ChampionshipApp(){
  const [session,setSession]=useState<Session|null>(null)
  const [profile,setProfile]=useState<Profile|null>(null)
  const [championships,setChampionships]=useState<Championship[]>([])
  const [teams,setTeams]=useState<Team[]>([])
  const [players,setPlayers]=useState<Player[]>([])
  const [matches,setMatches]=useState<Match[]>([])
  const [selectedId,setSelectedId]=useState('')
  const [tab,setTab]=useState<Tab>('inicio')
  const [loading,setLoading]=useState(true)
  const [notice,setNotice]=useState('')
  const [recoveryMode,setRecoveryMode]=useState(new URLSearchParams(location.search).get('reset')==='1')

  useEffect(()=>{
    const params=new URLSearchParams(location.search)
    const error=params.get('error_description')
    if(error) setNotice(decodeURIComponent(error.replace(/\+/g,' ')))
    else if(params.get('confirmed')==='1') setNotice('E-mail confirmado com sucesso. Você já pode entrar.')
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data}=supabase.auth.onAuthStateChange((event,next)=>{setSession(next);if(event==='PASSWORD_RECOVERY')setRecoveryMode(true);if(!next){setProfile(null);setChampionships([]);setTeams([]);setPlayers([]);setMatches([])}})
    return ()=>data.subscription.unsubscribe()
  },[])

  useEffect(()=>{if(session?.user.id&&!recoveryMode)void loadData()},[session?.user.id,recoveryMode])

  async function loadData(preferred?:string){
    if(!session?.user.id)return
    setLoading(true)
    const [p,c,t,pl,m]=await Promise.all([
      supabase.from('profiles').select('id,full_name,email').eq('id',session.user.id).maybeSingle(),
      supabase.from('championships').select('*').order('created_at',{ascending:false}),
      supabase.from('teams').select('*').order('name'),
      supabase.from('players').select('*').order('name'),
      supabase.from('matches').select('*').order('round').order('scheduled_at')
    ])
    const err=p.error||c.error||t.error||pl.error||m.error
    if(err)setNotice(err.message)
    if(p.data)setProfile(p.data as Profile)
    const cs=(c.data||[]) as Championship[]; setChampionships(cs)
    const wanted=preferred||selectedId; setSelectedId(wanted&&cs.some(x=>x.id===wanted)?wanted:(cs[0]?.id||''))
    setTeams((t.data||[]) as Team[]);setPlayers((pl.data||[]) as Player[]);setMatches((m.data||[]) as Match[]);setLoading(false)
  }

  const selected=championships.find(x=>x.id===selectedId)||null
  const selectedTeams=useMemo(()=>teams.filter(x=>x.championship_id===selectedId),[teams,selectedId])
  const teamIds=useMemo(()=>new Set(selectedTeams.map(x=>x.id)),[selectedTeams])
  const selectedPlayers=useMemo(()=>players.filter(x=>teamIds.has(x.team_id)),[players,teamIds])
  const selectedMatches=useMemo(()=>matches.filter(x=>x.championship_id===selectedId),[matches,selectedId])
  const standings=useMemo(()=>calculateStandings(selectedTeams,selectedMatches),[selectedTeams,selectedMatches])

  if(recoveryMode&&session)return <ResetPassword onDone={()=>{setRecoveryMode(false);history.replaceState({},'', '/')}}/>
  if(loading&&!session)return <div className="center-screen">Carregando…</div>
  if(!session)return <AuthScreen initialMessage={notice}/>

  return <div className="cm-shell">
    <aside className="cm-sidebar">
      <div className="cm-brand"><div className="cm-brand-icon"><Trophy size={22}/></div><div><strong>Bracketly</strong><span>Gestor de campeonatos</span></div></div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={tab===id?'cm-nav active':'cm-nav'} onClick={()=>setTab(id)}><Icon size={18}/>{label}</button>)}</nav>
      <div className="cm-account"><div><CircleUserRound size={20}/><span><strong>{profile?.full_name||session.user.email}</strong><small>{session.user.email}</small></span></div><button onClick={()=>void supabase.auth.signOut()}><LogOut size={16}/> Sair</button></div>
    </aside>
    <main className="cm-main">
      <header className="cm-topbar"><div><p>PAINEL DO ORGANIZADOR</p><h1>{nav.find(x=>x[0]===tab)?.[1]}</h1></div><div className="cm-top-actions">{championships.length>0&&<select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{championships.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}<button className="btn secondary" onClick={()=>void loadData()}><RefreshCw size={16}/> Atualizar</button></div></header>
      {notice&&<div className="notice">{notice}</div>}
      {loading?<div className="loading-card">Atualizando dados…</div>:<>
        {tab==='inicio'&&<Overview championship={selected} teams={selectedTeams} players={selectedPlayers} matches={selectedMatches} standings={standings} go={setTab}/>} 
        {tab==='campeonatos'&&<Championships championships={championships} selectedId={selectedId} userId={session.user.id} onSelect={setSelectedId} reload={loadData}/>} 
        {tab==='times'&&<Teams championship={selected} teams={selectedTeams} players={players} reload={()=>loadData(selectedId)} go={setTab}/>} 
        {tab==='partidas'&&<Matches championship={selected} teams={selectedTeams} matches={selectedMatches} reload={()=>loadData(selectedId)}/>} 
        {tab==='classificacao'&&<Standings championship={selected} rows={standings}/>} 
      </>}
    </main>
  </div>
}

function AuthScreen({initialMessage}:{initialMessage:string}){
  const [mode,setMode]=useState<'login'|'register'|'forgot'>('login'),[fullName,setFullName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState(initialMessage)
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setFeedback('');if(mode==='register'){const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:fullName},emailRedirectTo:`${siteUrl}/?confirmed=1`}});setFeedback(error?error.message:'Cadastro realizado. Confira seu e-mail para confirmar a conta.')}else if(mode==='forgot'){const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${siteUrl}/?reset=1`});setFeedback(error?error.message:'Enviamos o link de redefinição para seu e-mail.')}else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setFeedback(error.message)}setBusy(false)}
  return <div className="auth-screen"><section className="auth-copy"><div className="auth-logo"><Trophy size={22}/> Bracketly</div><h1>Organize campeonatos sem planilhas.</h1><p>Cadastre times, gere rodadas, lance resultados e acompanhe a classificação em um só lugar.</p><div className="auth-points"><span><CheckCircle2 size={17}/> Cadastro de usuários</span><span><CheckCircle2 size={17}/> Dados protegidos por conta</span><span><CheckCircle2 size={17}/> Classificação automática</span></div></section><form className="auth-form" onSubmit={submit}><p className="eyebrow">ACESSO</p><h2>{mode==='login'?'Entrar na sua conta':mode==='register'?'Criar sua conta':'Recuperar senha'}</h2>{mode==='register'&&<label>Nome completo<input value={fullName} onChange={e=>setFullName(e.target.value)} required/></label>}<label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>{mode!=='forgot'&&<label>Senha<input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></label>}{feedback&&<div className="notice">{feedback}</div>}<button className="btn primary" disabled={busy}>{busy?'Processando…':mode==='login'?'Entrar':mode==='register'?'Cadastrar':'Enviar link'}</button>{mode==='login'&&<button type="button" className="link-btn" onClick={()=>setMode('forgot')}><KeyRound size={15}/> Esqueci minha senha</button>}<button type="button" className="link-btn" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Ainda não tenho conta':'Voltar para o login'}</button></form></div>
}

function ResetPassword({onDone}:{onDone:()=>void}){const [a,setA]=useState(''),[b,setB]=useState(''),[feedback,setFeedback]=useState('');async function submit(e:FormEvent){e.preventDefault();if(a!==b)return setFeedback('As senhas não coincidem.');const {error}=await supabase.auth.updateUser({password:a});if(error)setFeedback(error.message);else{await supabase.auth.signOut();onDone()}}return <div className="center-screen"><form className="auth-form" onSubmit={submit}><h2>Nova senha</h2><label>Senha<input type="password" minLength={8} value={a} onChange={e=>setA(e.target.value)} required/></label><label>Confirmar senha<input type="password" minLength={8} value={b} onChange={e=>setB(e.target.value)} required/></label>{feedback&&<div className="notice">{feedback}</div>}<button className="btn primary">Salvar nova senha</button></form></div>}

function Overview({championship,teams,players,matches,standings,go}:{championship:Championship|null;teams:Team[];players:Player[];matches:Match[];standings:Standing[];go:(t:Tab)=>void}){
  if(!championship)return <Empty title="Comece criando seu campeonato" text="Depois você adiciona os times, gera as partidas e lança os resultados." action={<button className="btn primary" onClick={()=>go('campeonatos')}><Plus size={16}/> Criar campeonato</button>}/>
  const steps=[{ok:true,label:'Campeonato criado',tab:'campeonatos' as Tab},{ok:teams.length>=2,label:'Cadastrar pelo menos 2 times',tab:'times' as Tab},{ok:matches.length>0,label:'Criar ou gerar partidas',tab:'partidas' as Tab},{ok:matches.some(m=>m.status==='finalizado'),label:'Lançar o primeiro resultado',tab:'partidas' as Tab}]
  const done=steps.filter(s=>s.ok).length
  return <div className="stack"><section className="hero"><div><span className={`status status-${championship.status}`}>{statusLabel(championship.status)}</span><h2>{championship.name}</h2><p>{championship.sport} · {championship.format}</p></div><Trophy size={70}/></section><section className="stats"><Stat label="Times" value={teams.length} text={`de ${championship.max_teams} vagas`}/><Stat label="Jogadores" value={players.length} text="cadastrados"/><Stat label="Partidas" value={matches.length} text={`${matches.filter(m=>m.status==='finalizado').length} finalizadas`}/><Stat label="Líder" value={standings[0]?.team.short_name||standings[0]?.team.name||'—'} text={standings[0]?`${standings[0].points} pontos`:'sem resultados'}/></section><section className="grid-two"><div className="panel"><div className="panel-head"><div><p className="eyebrow">PRÓXIMOS PASSOS</p><h3>Configuração {done}/4</h3></div></div><div className="steps">{steps.map((s,i)=><button key={i} className={s.ok?'step done':'step'} onClick={()=>go(s.tab)}><span>{s.ok?<CheckCircle2 size={19}/>:i+1}</span><strong>{s.label}</strong><ChevronRight size={18}/></button>)}</div></div><div className="panel"><p className="eyebrow">CLASSIFICAÇÃO</p><h3>Top 5</h3>{standings.length?<div className="ranking-mini">{standings.slice(0,5).map((r,i)=><div key={r.team.id}><span>{i+1}</span><strong>{r.team.name}</strong><b>{r.points} pts</b></div>)}</div>:<p className="muted">Cadastre os times para começar.</p>}</div></section></div>
}

function Championships({championships,selectedId,userId,onSelect,reload}:{championships:Championship[];selectedId:string;userId:string;onSelect:(id:string)=>void;reload:(id?:string)=>Promise<void>}){
  const [show,setShow]=useState(false),[editing,setEditing]=useState<Championship|null>(null),[name,setName]=useState(''),[sport,setSport]=useState('Futebol'),[format,setFormat]=useState<Championship['format']>('Pontos corridos'),[start,setStart]=useState(''),[max,setMax]=useState(8),[feedback,setFeedback]=useState('')
  function openEdit(c:Championship){setEditing(c);setName(c.name);setSport(c.sport);setFormat(c.format);setStart(c.start_date||'');setMax(c.max_teams);setShow(true)}
  function reset(){setEditing(null);setName('');setSport('Futebol');setFormat('Pontos corridos');setStart('');setMax(8);setShow(false)}
  async function save(e:FormEvent){e.preventDefault();setFeedback('');if(max<2)return setFeedback('O campeonato precisa permitir pelo menos 2 times.');if(editing){const {error}=await supabase.from('championships').update({name:name.trim(),sport:sport.trim(),format,start_date:start||null,max_teams:max,updated_at:new Date().toISOString()}).eq('id',editing.id);if(error)return setFeedback(error.message);await reload(editing.id)}else{const {data,error}=await supabase.from('championships').insert({owner_id:userId,name:name.trim(),sport:sport.trim(),format,start_date:start||null,max_teams:max}).select('id').single();if(error)return setFeedback(error.message);await reload(data.id);onSelect(data.id)}reset()}
  async function remove(c:Championship){if(!confirm(`Excluir “${c.name}” e todos os dados vinculados?`))return;const {error}=await supabase.from('championships').delete().eq('id',c.id);if(error)setFeedback(error.message);else await reload()}
  async function status(c:Championship,s:Championship['status']){const {error}=await supabase.from('championships').update({status:s,updated_at:new Date().toISOString()}).eq('id',c.id);if(error)setFeedback(error.message);else await reload(c.id)}
  return <div className="stack"><div className="page-actions"><p className="muted">Crie campeonatos separados e alterne entre eles no topo.</p><button className="btn primary" onClick={()=>{reset();setShow(true)}}><Plus size={16}/> Novo campeonato</button></div>{show&&<form className="panel form-grid" onSubmit={save}><label className="span2">Nome<input value={name} onChange={e=>setName(e.target.value)} minLength={3} required/></label><label>Modalidade<input value={sport} onChange={e=>setSport(e.target.value)} required/></label><label>Formato<select value={format} onChange={e=>setFormat(e.target.value as Championship['format'])}><option>Pontos corridos</option><option>Mata-mata</option><option>Grupos + mata-mata</option></select></label><label>Data de início<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Máximo de times<input type="number" min={2} max={64} value={max} onChange={e=>setMax(Number(e.target.value))}/></label><div className="form-actions span2"><button type="button" className="btn secondary" onClick={reset}>Cancelar</button><button className="btn primary">{editing?'Salvar alterações':'Criar campeonato'}</button></div></form>}{feedback&&<div className="notice">{feedback}</div>}{championships.length===0?<Empty title="Nenhum campeonato" text="Crie o primeiro para começar."/>:<div className="cards">{championships.map(c=><article className={c.id===selectedId?'champ-card selected':'champ-card'} key={c.id} onClick={()=>onSelect(c.id)}><div><span className={`status status-${c.status}`}>{statusLabel(c.status)}</span><h3>{c.name}</h3><p>{c.sport} · {c.format}</p></div><div className="card-actions"><select value={c.status} onClick={e=>e.stopPropagation()} onChange={e=>void status(c,e.target.value as Championship['status'])}><option value="rascunho">Rascunho</option><option value="aberto">Inscrições abertas</option><option value="em_andamento">Em andamento</option><option value="finalizado">Finalizado</option></select><button className="icon-btn" onClick={e=>{e.stopPropagation();openEdit(c)}}><Pencil size={16}/></button><button className="icon-btn danger" onClick={e=>{e.stopPropagation();void remove(c)}}><Trash2 size={16}/></button></div></article>)}</div>}</div>
}

function Teams({championship,teams,players,reload,go}:{championship:Championship|null;teams:Team[];players:Player[];reload:()=>Promise<void>;go:(t:Tab)=>void}){
  const [name,setName]=useState(''),[short,setShort]=useState(''),[city,setCity]=useState(''),[open,setOpen]=useState(''),[pname,setPname]=useState(''),[shirt,setShirt]=useState(''),[position,setPosition]=useState(''),[feedback,setFeedback]=useState('')
  if(!championship)return <Empty title="Selecione um campeonato" text="Você precisa de um campeonato antes de cadastrar times." action={<button className="btn primary" onClick={()=>go('campeonatos')}>Ir para campeonatos</button>}/>
  const championshipId=championship.id, maxTeams=championship.max_teams
  async function addTeam(e:FormEvent){e.preventDefault();setFeedback('');if(teams.length>=maxTeams)return setFeedback('O limite de times foi atingido.');if(teams.some(t=>t.name.trim().toLowerCase()===name.trim().toLowerCase()))return setFeedback('Já existe um time com esse nome.');const {error}=await supabase.from('teams').insert({championship_id:championshipId,name:name.trim(),short_name:short.trim().toUpperCase()||null,city:city.trim()||null});if(error)setFeedback(error.message);else{setName('');setShort('');setCity('');await reload()}}
  async function addPlayer(e:FormEvent,teamId:string){e.preventDefault();setFeedback('');const roster=players.filter(p=>p.team_id===teamId);if(shirt&&roster.some(p=>p.shirt_number===Number(shirt)))return setFeedback('Esse número de camisa já está em uso neste time.');const {error}=await supabase.from('players').insert({team_id:teamId,name:pname.trim(),shirt_number:shirt?Number(shirt):null,position:position.trim()||null});if(error)setFeedback(error.message);else{setPname('');setShirt('');setPosition('');await reload()}}
  async function delTeam(id:string){if(!confirm('Excluir este time e seus jogadores?'))return;const {error}=await supabase.from('teams').delete().eq('id',id);if(error)setFeedback(error.message);else await reload()}
  async function delPlayer(id:string){const {error}=await supabase.from('players').delete().eq('id',id);if(error)setFeedback(error.message);else await reload()}
  return <div className="stack"><form className="panel team-form" onSubmit={addTeam}><div><p className="eyebrow">NOVO TIME</p><h3>{teams.length}/{maxTeams} cadastrados</h3></div><label>Nome<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Sigla<input value={short} maxLength={5} onChange={e=>setShort(e.target.value)} placeholder="ABC"/></label><label>Cidade<input value={city} onChange={e=>setCity(e.target.value)} placeholder="Opcional"/></label><button className="btn primary"><Plus size={16}/> Adicionar</button></form>{feedback&&<div className="notice">{feedback}</div>}{teams.length===0?<Empty title="Nenhum time cadastrado" text="Adicione pelo menos dois times para criar partidas."/>:<div className="team-list">{teams.map(t=>{const roster=players.filter(p=>p.team_id===t.id);const expanded=open===t.id;return <article className="team-card" key={t.id}><div className="team-summary"><button className="team-main" onClick={()=>setOpen(expanded?'':t.id)}><span className="badge">{t.short_name||initials(t.name)}</span><span><strong>{t.name}</strong><small>{t.city||'Cidade não informada'} · {roster.length} jogadores</small></span></button><button className="icon-btn danger" onClick={()=>void delTeam(t.id)}><Trash2 size={16}/></button></div>{expanded&&<div className="roster"><div>{roster.length===0?<p className="muted">Nenhum jogador cadastrado.</p>:roster.map(p=><div className="player-row" key={p.id}><b>{p.shirt_number??'—'}</b><span><strong>{p.name}</strong><small>{p.position||'Posição não informada'}</small></span><button className="icon-btn danger" onClick={()=>void delPlayer(p.id)}><Trash2 size={14}/></button></div>)}</div><form className="player-form" onSubmit={e=>void addPlayer(e,t.id)}><input value={pname} onChange={e=>setPname(e.target.value)} placeholder="Nome do jogador" required/><input type="number" min={0} max={99} value={shirt} onChange={e=>setShirt(e.target.value)} placeholder="Nº"/><input value={position} onChange={e=>setPosition(e.target.value)} placeholder="Posição"/><button className="btn secondary"><UserPlus size={16}/> Adicionar</button></form></div>}</article>})}</div>}</div>
}

function Matches({championship,teams,matches,reload}:{championship:Championship|null;teams:Team[];matches:Match[];reload:()=>Promise<void>}){
  const [home,setHome]=useState(''),[away,setAway]=useState(''),[round,setRound]=useState(1),[date,setDate]=useState(''),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false)
  if(!championship)return <Empty title="Selecione um campeonato" text="As partidas ficam vinculadas ao campeonato selecionado."/>
  const championshipId=championship.id
  const teamName=(id:string)=>teams.find(t=>t.id===id)?.name||'Time removido'
  async function add(e:FormEvent){e.preventDefault();setFeedback('');if(home===away)return setFeedback('Selecione times diferentes.');if(matches.some(m=>m.round===round&&((m.home_team_id===home&&m.away_team_id===away)||(m.home_team_id===away&&m.away_team_id===home))))return setFeedback('Essa partida já existe nesta rodada.');const {error}=await supabase.from('matches').insert({championship_id:championshipId,home_team_id:home,away_team_id:away,round,scheduled_at:date?new Date(date).toISOString():null});if(error)setFeedback(error.message);else{setHome('');setAway('');setDate('');await reload()}}
  async function generate(){if(teams.length<2)return setFeedback('Cadastre pelo menos 2 times.');if(matches.length>0&&!confirm('Já existem partidas. Deseja adicionar uma tabela automática mesmo assim?'))return;setBusy(true);setFeedback('');const fixtures=roundRobin(teams.map(t=>t.id)).map(f=>({championship_id:championshipId,home_team_id:f.home,away_team_id:f.away,round:f.round,status:'agendado'}));const {error}=await supabase.from('matches').insert(fixtures);if(error)setFeedback(error.message);else await reload();setBusy(false)}
  async function saveResult(id:string,a:string,b:string){const hs=Number(a),as=Number(b);if(!Number.isInteger(hs)||!Number.isInteger(as)||hs<0||as<0)return setFeedback('Informe placares válidos.');const {error}=await supabase.from('matches').update({home_score:hs,away_score:as,status:'finalizado'}).eq('id',id);if(error)setFeedback(error.message);else await reload()}
  async function del(id:string){const {error}=await supabase.from('matches').delete().eq('id',id);if(error)setFeedback(error.message);else await reload()}
  const grouped=useMemo(()=>Array.from(new Set(matches.map(m=>m.round))).sort((a,b)=>a-b),[matches])
  return <div className="stack"><div className="page-actions"><p className="muted">Você pode criar jogos manualmente ou gerar todos os confrontos automaticamente.</p><button className="btn primary" disabled={busy||teams.length<2} onClick={()=>void generate()}><CalendarDays size={16}/> {busy?'Gerando…':'Gerar tabela automática'}</button></div>{teams.length>=2&&<form className="panel match-form" onSubmit={add}><label>Mandante<select value={home} onChange={e=>setHome(e.target.value)} required><option value="">Selecione</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Visitante<select value={away} onChange={e=>setAway(e.target.value)} required><option value="">Selecione</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Rodada<input type="number" min={1} value={round} onChange={e=>setRound(Number(e.target.value))}/></label><label>Data e hora<input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="btn secondary"><Plus size={16}/> Adicionar partida</button></form>}{feedback&&<div className="notice">{feedback}</div>}{matches.length===0?<Empty title="Nenhuma partida" text={teams.length<2?'Cadastre pelo menos dois times primeiro.':'Use “Gerar tabela automática” para criar as rodadas em segundos.'}/>:<div className="rounds">{grouped.map(r=><section className="panel" key={r}><div className="panel-head"><h3>Rodada {r}</h3><span>{matches.filter(m=>m.round===r).length} jogos</span></div><div className="match-list">{matches.filter(m=>m.round===r).map(m=><MatchRow key={m.id} match={m} home={teamName(m.home_team_id)} away={teamName(m.away_team_id)} save={saveResult} del={del}/>)}</div></section>)}</div>}</div>
}

function MatchRow({match,home,away,save,del}:{match:Match;home:string;away:string;save:(id:string,a:string,b:string)=>Promise<void>|void;del:(id:string)=>Promise<void>|void}){const [a,setA]=useState(match.home_score?.toString()??''),[b,setB]=useState(match.away_score?.toString()??'');useEffect(()=>{setA(match.home_score?.toString()??'');setB(match.away_score?.toString()??'')},[match.home_score,match.away_score]);return <div className="match-row"><div className="match-info"><small>{match.scheduled_at?formatDate(match.scheduled_at):'Sem data definida'}</small><strong>{home} <span>×</span> {away}</strong></div><div className="score"><input type="number" min={0} value={a} onChange={e=>setA(e.target.value)}/><span>×</span><input type="number" min={0} value={b} onChange={e=>setB(e.target.value)}/><button className="btn secondary small" onClick={()=>void save(match.id,a,b)}>Salvar</button><button className="icon-btn danger" onClick={()=>void del(match.id)}><Trash2 size={15}/></button></div></div>}

function Standings({championship,rows}:{championship:Championship|null;rows:Standing[]}){if(!championship)return <Empty title="Selecione um campeonato" text="Escolha um campeonato para ver a classificação."/>;return <div className="panel"><div className="panel-head"><div><p className="eyebrow">CLASSIFICAÇÃO</p><h3>{championship.name}</h3></div><span>3 pontos por vitória</span></div>{rows.length===0?<p className="muted">Cadastre os times para montar a tabela.</p>:<div className="table-wrap"><table><thead><tr><th>#</th><th>Time</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.team.id}><td>{i+1}</td><td><strong>{r.team.name}</strong></td><td><b>{r.points}</b></td><td>{r.played}</td><td>{r.wins}</td><td>{r.draws}</td><td>{r.losses}</td><td>{r.goalsFor}</td><td>{r.goalsAgainst}</td><td>{r.goalDiff}</td></tr>)}</tbody></table></div>}</div>}

function Empty({title,text,action}:{title:string;text:string;action?:React.ReactNode}){return <div className="empty"><Trophy size={34}/><h2>{title}</h2><p>{text}</p>{action}</div>}
function Stat({label,value,text}:{label:string;value:string|number;text:string}){return <div className="stat"><span>{label}</span><strong>{value}</strong><small>{text}</small></div>}
function statusLabel(s:Championship['status']){return s==='rascunho'?'Rascunho':s==='aberto'?'Inscrições abertas':s==='em_andamento'?'Em andamento':'Finalizado'}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function formatDate(v:string){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}
function roundRobin(ids:string[]){const list=[...ids];if(list.length%2)list.push('BYE');const n=list.length, rounds:{round:number;home:string;away:string}[]=[];for(let r=0;r<n-1;r++){for(let i=0;i<n/2;i++){const a=list[i],b=list[n-1-i];if(a!=='BYE'&&b!=='BYE')rounds.push({round:r+1,home:r%2===0?a:b,away:r%2===0?b:a})}list.splice(1,0,list.pop()!)}return rounds}
function calculateStandings(teams:Team[],matches:Match[]):Standing[]{const map=new Map<string,Standing>();teams.forEach(team=>map.set(team.id,{team,points:0,played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,goalDiff:0}));matches.filter(m=>m.status==='finalizado'&&m.home_score!==null&&m.away_score!==null).forEach(m=>{const h=map.get(m.home_team_id),a=map.get(m.away_team_id);if(!h||!a)return;const hs=m.home_score!,as=m.away_score!;h.played++;a.played++;h.goalsFor+=hs;h.goalsAgainst+=as;a.goalsFor+=as;a.goalsAgainst+=hs;if(hs>as){h.wins++;h.points+=3;a.losses++}else if(as>hs){a.wins++;a.points+=3;h.losses++}else{h.draws++;a.draws++;h.points++;a.points++}});for(const r of map.values())r.goalDiff=r.goalsFor-r.goalsAgainst;return [...map.values()].sort((a,b)=>b.points-a.points||b.wins-a.wins||b.goalDiff-a.goalDiff||b.goalsFor-a.goalsFor||a.team.name.localeCompare(b.team.name))}

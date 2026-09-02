import { useEffect, useState } from 'react'
import { Copy, Globe2, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import ChampionshipAppV3 from './ChampionshipAppV3'
import { siteUrl, supabase } from './lib/supabase'

type Item={id:string;name:string;is_public:boolean;public_slug:string}

export default function ChampionshipAppV4(){
 const[session,setSession]=useState<Session|null>(null),[open,setOpen]=useState(false),[items,setItems]=useState<Item[]>([]),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('')
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));const{data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[])
 async function load(){if(!session?.user.id)return;setBusy(true);const{data,error}=await supabase.from('championships').select('id,name,is_public,public_slug').eq('owner_id',session.user.id).order('created_at',{ascending:false});if(error)setFeedback(error.message);else setItems((data||[]) as Item[]);setBusy(false)}
 async function show(){setOpen(true);setFeedback('');await load()}
 async function toggle(item:Item){setFeedback('');const{error}=await supabase.from('championships').update({is_public:!item.is_public,updated_at:new Date().toISOString()}).eq('id',item.id);if(error)setFeedback(error.message);else await load()}
 async function copy(item:Item){const url=`${siteUrl}/?public=${item.public_slug}`;await navigator.clipboard.writeText(url);setFeedback('Link público copiado.')}
 return <><ChampionshipAppV3/>{session&&<button className="share-fab" onClick={()=>void show()}><Globe2 size={18}/> Compartilhar</button>}{open&&<div className="share-backdrop" onClick={()=>setOpen(false)}><section className="share-modal" onClick={e=>e.stopPropagation()}><header><div><p className="eyebrow">PÁGINA PÚBLICA</p><h2>Compartilhar campeonato</h2></div><button className="icon-btn" onClick={()=>setOpen(false)}><X size={18}/></button></header><p className="muted">Ative apenas os campeonatos que você quer que qualquer pessoa possa acompanhar sem login.</p>{feedback&&<div className="notice">{feedback}</div>}{busy?<p>Carregando…</p>:items.length===0?<p className="muted">Você ainda não criou campeonatos.</p>:<div className="share-list">{items.map(i=><article key={i.id}><div><strong>{i.name}</strong><small>{i.is_public?'Página pública ativa':'Somente usuários do campeonato'}</small></div><label className="share-switch"><input type="checkbox" checked={i.is_public} onChange={()=>void toggle(i)}/><span/></label>{i.is_public&&<button className="btn secondary small" onClick={()=>void copy(i)}><Copy size={15}/> Copiar link</button>}</article>)}</div>}</section></div>}</>
}

-- Atualização incremental para o banco Bracketly existente. Não remove dados.
begin;
create or replace function private.owns_championship(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.championships where id=p_id and owner_id=auth.uid());
$$;
revoke all on function private.owns_championship(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.owns_championship(uuid) to authenticated;
drop policy if exists members_select_championship_members on public.championship_members;
create policy members_select_championship_members on public.championship_members for select to authenticated
using(user_id=(select auth.uid()) or private.owns_championship(championship_id));
create or replace function private.is_championship_member(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.championship_members where championship_id=p_id and user_id=auth.uid());
$$;
revoke all on function private.is_championship_member(uuid) from public,anon;
grant execute on function private.is_championship_member(uuid) to authenticated;
drop policy if exists owners_or_members_select_championships on public.championships;
create policy owners_or_members_select_championships on public.championships for select to authenticated
using(owner_id=(select auth.uid()) or private.is_championship_member(id));
drop policy if exists owners_delete_championship_members on public.championship_members;
create policy owners_delete_championship_members on public.championship_members for delete to authenticated
using(private.owns_championship(championship_id));
-- Public pages never need invitation codes, owner IDs or manager IDs.
revoke select on public.championships,public.teams from anon;
grant select(id,name,sport,format,status,start_date,end_date,max_teams,is_public,public_slug) on public.championships to anon;
grant select(id,championship_id,name,short_name,city) on public.teams to anon;
alter table public.championships alter column public_slug set default gen_random_uuid()::text;
update public.championships set public_slug=gen_random_uuid()::text where public_slug is null;

create or replace function private.guard_championship()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.id::text,0));
 if length(trim(new.name))<3 or length(trim(new.sport))=0 then raise exception 'Informe nome e modalidade válidos.'; end if;
 if new.end_date<new.start_date then raise exception 'O término não pode ser anterior ao início.'; end if;
 if new.max_teams<2 or new.max_teams>64 then raise exception 'Use de 2 a 64 times.'; end if;
 if tg_op='UPDATE' then
  if new.owner_id<>old.owner_id then raise exception 'O organizador não pode ser alterado.'; end if;
  if new.max_teams<(select count(*) from public.teams where championship_id=new.id) then raise exception 'O limite não pode ser menor que o total de times cadastrados.'; end if;
  if new.format<>old.format and exists(select 1 from public.matches where championship_id=new.id) then raise exception 'O formato não pode mudar após cadastrar partidas.'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists guard_championship on public.championships;
create trigger guard_championship before insert or update on public.championships for each row execute function private.guard_championship();

create or replace function private.guard_team()
returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.championships; target uuid;
begin
 target:=case when tg_op='DELETE' then old.championship_id else new.championship_id end;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 select * into c from public.championships where id=target;
 if tg_op='DELETE' then
  if c.id is not null and exists(select 1 from public.matches where home_team_id=old.id or away_team_id=old.id) then raise exception 'Este time possui partidas. Remova as partidas antes de excluir o time.'; end if;
  return old;
 end if;
 if tg_op='UPDATE' and new.championship_id<>old.championship_id then raise exception 'Não é possível transferir um time entre campeonatos.'; end if;
 if length(trim(new.name))=0 then raise exception 'Informe o nome do time.'; end if;
 if tg_op='INSERT' and (select count(*) from public.teams where championship_id=new.championship_id)>=c.max_teams then raise exception 'O limite de times foi atingido.'; end if;
 if exists(select 1 from public.teams where championship_id=new.championship_id and lower(trim(name))=lower(trim(new.name)) and id<>new.id) then raise exception 'Já existe um time com esse nome.'; end if;
 if new.manager_user_id is not null and new.manager_user_id<>c.owner_id and not exists(select 1 from public.championship_members where championship_id=new.championship_id and user_id=new.manager_user_id) then raise exception 'O responsável precisa participar do campeonato.'; end if;
 return new;
end; $$;
drop trigger if exists guard_team on public.teams;
create trigger guard_team before insert or update or delete on public.teams for each row execute function private.guard_team();

create or replace function private.guard_player()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.team_id::text,1));
 if tg_op='UPDATE' and new.team_id<>old.team_id then raise exception 'Não é possível transferir o jogador por esta operação.'; end if;
 if length(trim(new.name))=0 then raise exception 'Informe o nome do jogador.'; end if;
 if new.shirt_number<0 or new.shirt_number>999 then raise exception 'Número de camisa inválido.'; end if;
 if new.shirt_number is not null and exists(select 1 from public.players where team_id=new.team_id and shirt_number=new.shirt_number and id<>new.id) then raise exception 'Esse número de camisa já está em uso.'; end if;
 return new;
end; $$;
drop trigger if exists guard_player on public.players;
create trigger guard_player before insert or update on public.players for each row execute function private.guard_player();

create or replace function private.guard_match()
returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.championships; target uuid;
begin
 target:=case when tg_op='DELETE' then old.championship_id else new.championship_id end;
 select * into c from public.championships where id=target for update;
 if tg_op in ('UPDATE','DELETE') and c.id is not null then
  if exists(select 1 from public.matches where championship_id=old.championship_id and bracket_stage is not null and (old.bracket_stage is null or round>old.round)) then
   raise exception 'Há uma fase eliminatória dependente. Remova a chave antes de alterar este jogo.';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 if tg_op='UPDATE' and (new.championship_id<>old.championship_id or new.bracket_stage is distinct from old.bracket_stage or new.bracket_position is distinct from old.bracket_position or new.round<>old.round or new.home_team_id<>old.home_team_id or new.away_team_id<>old.away_team_id) then raise exception 'Os confrontos existentes não podem ser transferidos ou reorganizados.'; end if;
 if new.home_team_id=new.away_team_id then raise exception 'Selecione times diferentes.'; end if;
 if (select count(*) from public.teams where id in (new.home_team_id,new.away_team_id) and championship_id=new.championship_id)<>2 then raise exception 'Os times precisam pertencer ao campeonato.'; end if;
 if new.home_score<0 or new.away_score<0 or new.penalty_home_score<0 or new.penalty_away_score<0 then raise exception 'Informe placares válidos.'; end if;
 if new.status='finalizado' and (new.home_score is null or new.away_score is null) then raise exception 'Informe os dois placares.'; end if;
 if new.bracket_stage is not null then
  if c.format='Pontos corridos' then raise exception 'Este campeonato não possui mata-mata.'; end if;
  if new.bracket_position is null or new.bracket_position<1 then raise exception 'Posição da chave inválida.'; end if;
  if exists(select 1 from public.matches where championship_id=new.championship_id and bracket_stage=new.bracket_stage and bracket_position=new.bracket_position and id<>new.id) then raise exception 'Este confronto já existe na chave.'; end if;
  if new.status='finalizado' and new.home_score=new.away_score and (new.penalty_home_score is null or new.penalty_away_score is null or new.penalty_home_score=new.penalty_away_score) then raise exception 'Um empate no mata-mata exige decisão por pênaltis.'; end if;
  if c.format='Grupos + mata-mata' and tg_op='INSERT' and (not exists(select 1 from public.matches where championship_id=new.championship_id and bracket_stage is null and status='finalizado') or exists(select 1 from public.matches where championship_id=new.championship_id and bracket_stage is null and status not in ('finalizado','cancelado'))) then raise exception 'Finalize a fase classificatória antes de gerar o mata-mata.'; end if;
 else
  if c.format='Mata-mata' then raise exception 'Use a chave eliminatória para cadastrar jogos.'; end if;
  if tg_op='INSERT' and exists(select 1 from public.matches where championship_id=new.championship_id and bracket_stage is not null) then raise exception 'A fase eliminatória já foi iniciada.'; end if;
  if exists(select 1 from public.matches where championship_id=new.championship_id and bracket_stage is null and round=new.round and least(home_team_id,away_team_id)=least(new.home_team_id,new.away_team_id) and greatest(home_team_id,away_team_id)=greatest(new.home_team_id,new.away_team_id) and id<>new.id and status<>'cancelado') then raise exception 'Este confronto já existe nesta rodada.'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists guard_match on public.matches;
create trigger guard_match before insert or update or delete on public.matches for each row execute function private.guard_match();

-- One transaction and one championship lock: saving the result and advancing cannot diverge.
create or replace function public.save_knockout_result(p_match uuid,p_home integer,p_away integer,p_penalty_home integer default null,p_penalty_away integer default null)
returns void language plpgsql security invoker set search_path='' as $$
declare m public.matches; winners uuid[]; next_stage text; i integer; total integer;
begin
 if auth.uid() is null then raise exception 'Entre para registrar o resultado.'; end if;
 select * into m from public.matches where id=p_match;
 if m.id is null or m.bracket_stage is null then raise exception 'Partida eliminatória não encontrada.'; end if;
 perform 1 from public.championships where id=m.championship_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Somente o organizador pode registrar resultados.'; end if;
 if p_home is null or p_away is null or p_home<0 or p_away<0 then raise exception 'Informe placares válidos.'; end if;
 update public.matches set home_score=p_home,away_score=p_away,penalty_home_score=case when p_home=p_away then p_penalty_home end,penalty_away_score=case when p_home=p_away then p_penalty_away end,status='finalizado' where id=p_match;
 if exists(select 1 from public.matches where championship_id=m.championship_id and bracket_stage=m.bracket_stage and status<>'finalizado') then return; end if;
 select array_agg(case when home_score>away_score or(home_score=away_score and penalty_home_score>penalty_away_score) then home_team_id else away_team_id end order by bracket_position) into winners from public.matches where championship_id=m.championship_id and bracket_stage=m.bracket_stage;
 total:=array_length(winners,1);
 if total=1 then return; end if;
 if total%2<>0 then raise exception 'A fase possui quantidade inválida de partidas.'; end if;
 next_stage:=case total when 32 then '16-avos' when 16 then 'Oitavas' when 8 then 'Quartas' when 4 then 'Semifinal' when 2 then 'Final' else null end;
 if next_stage is null then raise exception 'Tamanho de chave inválido.'; end if;
 if exists(select 1 from public.matches where championship_id=m.championship_id and bracket_stage=next_stage) then return; end if;
 i:=1;
 while i<=total loop
  insert into public.matches(championship_id,home_team_id,away_team_id,round,status,bracket_stage,bracket_position) values(m.championship_id,winners[i],winners[i+1],m.round+1,'agendado',next_stage,(i+1)/2);
  i:=i+2;
 end loop;
end; $$;
revoke all on function public.save_knockout_result(uuid,integer,integer,integer,integer) from public,anon;
grant execute on function public.save_knockout_result(uuid,integer,integer,integer,integer) to authenticated;

create or replace function public.reset_knockout(p_championship uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare r record;
begin
 if auth.uid() is null then raise exception 'Entre para gerenciar o campeonato.'; end if;
 perform 1 from public.championships where id=p_championship and owner_id=auth.uid() for update;
 if not found then raise exception 'Somente o organizador pode remover a chave.'; end if;
 for r in select id from public.matches where championship_id=p_championship and bracket_stage is not null order by round desc loop
  delete from public.matches where id=r.id;
 end loop;
end; $$;
revoke all on function public.reset_knockout(uuid) from public,anon;
grant execute on function public.reset_knockout(uuid) to authenticated;

-- Membership removal and manager unlinking are committed together.
create or replace function private.detach_member_teams()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or (auth.uid()<>old.user_id and not exists(select 1 from public.championships where id=old.championship_id and owner_id=auth.uid())) then
  -- Database-level cascades may occur without a browser session.
  if exists(select 1 from public.championships where id=old.championship_id) and exists(select 1 from auth.users where id=old.user_id) then raise exception 'Sem permissão para remover participante.'; end if;
 end if;
 update public.teams set manager_user_id=null where championship_id=old.championship_id and manager_user_id=old.user_id;
 return old;
end; $$;
revoke all on function private.detach_member_teams() from public,anon,authenticated;
drop trigger if exists detach_member_teams on public.championship_members;
create trigger detach_member_teams before delete on public.championship_members for each row execute function private.detach_member_teams();
revoke all on function private.guard_championship(),private.guard_team(),private.guard_player(),private.guard_match() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION private.join_championship_by_code(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_championship uuid;
begin
  if v_user is null then raise exception 'Você precisa estar autenticado.'; end if;
  select c.id into v_championship
  from public.championships c
  where upper(c.invite_code)=upper(trim(p_code)) and c.status in ('aberto','em_andamento')
  limit 1;
  if v_championship is null then raise exception 'Código inválido ou campeonato indisponível.'; end if;
  insert into public.championship_members(championship_id,user_id,role)
  values(v_championship,v_user,'participant')
  on conflict(championship_id,user_id) do nothing;
  return v_championship;
end;
$function$
;
revoke all on function private.join_championship_by_code(text) from public,anon;
grant execute on function private.join_championship_by_code(text) to authenticated;
create or replace function public.join_championship_by_code(p_code text) returns uuid language sql security invoker set search_path='' as $$ select private.join_championship_by_code(p_code); $$;
revoke all on function public.join_championship_by_code(text) from public,anon;
grant execute on function public.join_championship_by_code(text) to authenticated;
commit;

-- Run after championship_integrity.sql. Existing tournaments remain unchanged.
alter table public.teams add column if not exists group_name text
  check (group_name ~ '^[A-H]$');
grant select(group_name) on public.teams to anon;
create index if not exists teams_championship_group_idx on public.teams(championship_id,group_name);

create or replace function private.validate_groups(p_championship uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 select count(distinct group_name) into n from public.teams where championship_id=p_championship;
 if n not in (2,4,8) or exists(select 1 from public.teams where championship_id=p_championship and group_name is null)
 or exists(select 1 from public.teams where championship_id=p_championship group by group_name having count(*)<2)
 then raise exception 'Distribua todos os times em 2, 4 ou 8 grupos, com pelo menos 2 times em cada.'; end if;
end; $$;
revoke all on function private.validate_groups(uuid) from public,anon;
grant execute on function private.validate_groups(uuid) to authenticated;

create or replace function private.guard_group_team()
returns trigger language plpgsql security invoker set search_path='' as $$
declare target uuid;
begin
 target:=case when tg_op='DELETE' then old.championship_id else new.championship_id end;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 if tg_op='DELETE' then
  if exists(select 1 from public.championships where id=target) and old.group_name is not null and exists(select 1 from public.matches where championship_id=target) then raise exception 'Os participantes dos grupos ficam fixos após cadastrar partidas.'; end if;
  return old;
 end if;
 if tg_op='UPDATE' and new.name<>old.name and new.group_name is not null and exists(select 1 from public.matches where championship_id=target and bracket_stage is not null) then raise exception 'O nome do time participa do desempate e fica fixo enquanto existir a chave.'; end if;
 if tg_op='INSERT' or new.group_name is distinct from old.group_name then
  if new.group_name is not null and not private.owns_championship(target) then raise exception 'Somente o organizador pode distribuir os grupos.'; end if;
  if tg_op='UPDATE' and new.group_name is distinct from old.group_name and not private.owns_championship(target) then raise exception 'Somente o organizador pode distribuir os grupos.'; end if;
  if exists(select 1 from public.matches where championship_id=target) and
    (new.group_name is not null or exists(select 1 from public.teams where championship_id=target and group_name is not null)) then
    raise exception 'Os grupos e seus participantes ficam fixos após cadastrar partidas.';
  end if;
  if new.group_name is not null and not exists(select 1 from public.championships where id=target and format='Grupos + mata-mata') then raise exception 'Use o formato Grupos + mata-mata.'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists guard_group_team on public.teams;
create trigger guard_group_team before insert or update or delete on public.teams for each row execute function private.guard_group_team();

create or replace function private.guard_group_format()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.format <> 'Grupos + mata-mata' and exists(select 1 from public.teams where championship_id=new.id and group_name is not null) then raise exception 'Remova a distribuição de grupos antes de mudar o formato.'; end if;
 return new;
end; $$;
drop trigger if exists guard_group_format on public.championships;
create trigger guard_group_format before update on public.championships for each row execute function private.guard_group_format();

create or replace function public.configure_championship_groups(p_championship uuid,p_assignments jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_championship::text,0));
 if not private.owns_championship(p_championship) then raise exception 'Somente o organizador pode configurar grupos.'; end if;
 if not exists(select 1 from public.championships where id=p_championship and format='Grupos + mata-mata') then raise exception 'Use o formato Grupos + mata-mata.'; end if;
 if exists(select 1 from public.matches where championship_id=p_championship) then raise exception 'Configure os grupos antes de cadastrar partidas.'; end if;
 if jsonb_typeof(p_assignments) is distinct from 'object' then raise exception 'Distribuição inválida.'; end if;
 if (select count(*) from jsonb_object_keys(p_assignments))<>(select count(*) from public.teams where championship_id=p_championship)
 or exists(select 1 from public.teams where championship_id=p_championship and not p_assignments ? id::text)
 then raise exception 'Inclua todos os times do campeonato.'; end if;
 update public.teams set group_name=p_assignments->>id::text where championship_id=p_championship;
 perform private.validate_groups(p_championship);
end; $$;
revoke all on function public.configure_championship_groups(uuid,jsonb) from public,anon;
grant execute on function public.configure_championship_groups(uuid,jsonb) to authenticated;

-- Rankings use the same point criteria as the client, with deterministic name/ID ties.
create or replace function private.group_ranking(p_championship uuid)
returns table(team_id uuid,group_name text,group_rank bigint) language sql stable security invoker set search_path='' as $$
 with scores as (
 select t.id,t.name,t.group_name,
 coalesce(sum(case when m.home_team_id=t.id and m.home_score>m.away_score or m.away_team_id=t.id and m.away_score>m.home_score then 3 when m.home_score=m.away_score then 1 else 0 end),0) pts,
 count(m.id) filter(where m.home_team_id=t.id and m.home_score>m.away_score or m.away_team_id=t.id and m.away_score>m.home_score) wins,
 coalesce(sum(case when m.home_team_id=t.id then m.home_score-m.away_score else m.away_score-m.home_score end),0) sg,
 coalesce(sum(case when m.home_team_id=t.id then m.home_score else m.away_score end),0) gf
 from public.teams t left join public.matches m on m.championship_id=t.championship_id and (m.home_team_id=t.id or m.away_team_id=t.id) and m.bracket_stage is null and m.status='finalizado'
 where t.championship_id=p_championship and t.group_name is not null group by t.id
 ) select id,group_name,row_number() over(partition by group_name order by pts desc,wins desc,sg desc,gf desc,name collate "C",id) from scores;
$$;
revoke all on function private.group_ranking(uuid) from public,anon;
grant execute on function private.group_ranking(uuid) to authenticated;

create or replace function private.groups_complete(p_championship uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select not exists(
 select 1 from public.teams a join public.teams b on a.championship_id=b.championship_id and a.group_name=b.group_name and a.id<b.id
 where a.championship_id=p_championship and not exists(select 1 from public.matches m where m.championship_id=p_championship and m.bracket_stage is null and m.status='finalizado' and
 ((m.home_team_id=a.id and m.away_team_id=b.id) or (m.home_team_id=b.id and m.away_team_id=a.id))))
 and not exists(select 1 from public.matches where championship_id=p_championship and bracket_stage is null and status<>'finalizado');
$$;
revoke all on function private.groups_complete(uuid) from public,anon;
grant execute on function private.groups_complete(uuid) to authenticated;

create or replace function private.guard_group_match()
returns trigger language plpgsql security invoker set search_path='' as $$
declare hg text; ag text;
begin
 perform pg_advisory_xact_lock(hashtextextended(new.championship_id::text,0));
 if not exists(select 1 from public.teams where championship_id=new.championship_id and group_name is not null) then return new; end if;
 perform private.validate_groups(new.championship_id);
 select group_name into hg from public.teams where id=new.home_team_id;
 select group_name into ag from public.teams where id=new.away_team_id;
 if new.bracket_stage is null then
  if hg is null or ag is null or hg<>ag then raise exception 'Na fase de grupos, os times devem pertencer ao mesmo grupo.'; end if;
  if exists(select 1 from public.matches where championship_id=new.championship_id and bracket_stage is not null) then raise exception 'Remova a chave antes de alterar a fase de grupos.'; end if;
  if exists(select 1 from public.matches where championship_id=new.championship_id and bracket_stage is null and id<>new.id and least(home_team_id,away_team_id)=least(new.home_team_id,new.away_team_id) and greatest(home_team_id,away_team_id)=greatest(new.home_team_id,new.away_team_id)) then raise exception 'Este confronto do grupo já existe.'; end if;
 elsif tg_op='INSERT' then
  if not private.groups_complete(new.championship_id) then raise exception 'Finalize todos os confrontos de cada grupo, incluindo partidas canceladas ou ausentes.'; end if;
  if (select count(*) from private.group_ranking(new.championship_id) where group_rank<=2 and team_id in(new.home_team_id,new.away_team_id))<>2 then raise exception 'Somente os dois primeiros de cada grupo avançam.'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists guard_group_match on public.matches;
create trigger guard_group_match before insert or update on public.matches for each row execute function private.guard_group_match();
revoke all on function private.guard_group_team(),private.guard_group_format(),private.guard_group_match() from public,anon,authenticated;

create or replace function public.generate_group_matches(p_championship uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare g text; ids uuid[]; n integer; r integer; i integer; h uuid; a uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_championship::text,0));
 if not private.owns_championship(p_championship) then raise exception 'Somente o organizador pode gerar partidas.'; end if;
 perform private.validate_groups(p_championship);
 if exists(select 1 from public.matches where championship_id=p_championship) then raise exception 'Já existem partidas neste campeonato.'; end if;
 for g in select distinct group_name from public.teams where championship_id=p_championship order by group_name loop
  select array_agg(id order by name collate "C",id) into ids from public.teams where championship_id=p_championship and group_name=g;
  if cardinality(ids)%2=1 then ids:=array_append(ids,null::uuid); end if;
  n:=cardinality(ids);
  for r in 1..n-1 loop
   for i in 1..n/2 loop
    h:=ids[i]; a:=ids[n+1-i];
    if h is not null and a is not null then
     insert into public.matches(championship_id,home_team_id,away_team_id,round,status) values(p_championship,h,a,r,'agendado');
    end if;
   end loop;
   ids:=array[ids[1],ids[n]]||ids[2:n-1];
  end loop;
 end loop;
end; $$;
revoke all on function public.generate_group_matches(uuid) from public,anon;
grant execute on function public.generate_group_matches(uuid) to authenticated;

create or replace function public.generate_group_knockout(p_championship uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare gs text[]; n integer; i integer; h uuid; a uuid; stage text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_championship::text,0));
 if not private.owns_championship(p_championship) then raise exception 'Somente o organizador pode gerar a chave.'; end if;
 perform private.validate_groups(p_championship);
 if exists(select 1 from public.matches where championship_id=p_championship and bracket_stage is not null) then raise exception 'A chave já existe.'; end if;
 if not private.groups_complete(p_championship) then raise exception 'Finalize todos os confrontos de cada grupo, incluindo partidas canceladas ou ausentes.'; end if;
 select array_agg(distinct group_name order by group_name) into gs from public.teams where championship_id=p_championship;
 n:=cardinality(gs); stage:=case n when 2 then 'Semifinal' when 4 then 'Quartas' else 'Oitavas' end;
 for i in 1..n loop
  select team_id into h from private.group_ranking(p_championship) where group_name=gs[i] and group_rank=1;
  select team_id into a from private.group_ranking(p_championship) where group_name=gs[case when i%2=1 then i+1 else i-1 end] and group_rank=2;
  insert into public.matches(championship_id,home_team_id,away_team_id,round,status,bracket_stage,bracket_position) values(p_championship,h,a,1,'agendado',stage,i);
 end loop;
end; $$;
revoke all on function public.generate_group_knockout(uuid) from public,anon;
grant execute on function public.generate_group_knockout(uuid) to authenticated;
notify pgrst,'reload schema';

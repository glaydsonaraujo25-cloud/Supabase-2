-- Optional admissions and rules preserve existing tournaments.
alter table public.championships add column if not exists regulations text not null default '' check(length(regulations)<=20000);
alter table public.championships add column if not exists requires_team_approval boolean not null default false;
grant select(regulations,requires_team_approval) on public.championships to anon;

create table if not exists public.team_requests (
 id uuid primary key default gen_random_uuid(),
 championship_id uuid not null references public.championships(id) on delete cascade,
 requested_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 short_name text check(length(short_name)<=12), city text check(length(city)<=100),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 approved_team_id uuid,
 created_at timestamptz not null default now(), reviewed_at timestamptz
);
create index if not exists team_requests_championship_idx on public.team_requests(championship_id,created_at desc);
create index if not exists team_requests_user_idx on public.team_requests(requested_by);
create unique index if not exists team_requests_pending_idx on public.team_requests(championship_id,requested_by) where status='pending';
alter table public.team_requests enable row level security;
revoke all on public.team_requests from anon,authenticated;
grant select,insert,update,delete on public.team_requests to authenticated;
create policy requests_read on public.team_requests for select to authenticated
 using(requested_by=(select auth.uid()) or private.owns_championship(championship_id));
create policy requests_submit on public.team_requests for insert to authenticated
 with check(requested_by=(select auth.uid()) and private.is_championship_member(championship_id));
create policy requests_review on public.team_requests for update to authenticated
 using(private.owns_championship(championship_id)) with check(private.owns_championship(championship_id));
create policy requests_withdraw on public.team_requests for delete to authenticated
 using(requested_by=(select auth.uid()) and status='pending');

create or replace function private.guard_team_request()
returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.championships;
begin
 perform pg_advisory_xact_lock(hashtextextended(new.championship_id::text,0));
 select * into c from public.championships where id=new.championship_id;
 if c.id is null then raise exception 'Campeonato indisponível.'; end if;
 if tg_op='INSERT' then
  if auth.uid() is null or new.requested_by<>auth.uid() or not private.is_championship_member(c.id) then raise exception 'Entre no campeonato antes de solicitar inscrição.'; end if;
  if not c.requires_team_approval or c.status<>'aberto' then raise exception 'As inscrições com aprovação não estão abertas.'; end if;
  if new.status<>'pending' or new.approved_team_id is not null or new.reviewed_at is not null then raise exception 'A inscrição deve começar pendente.'; end if;
  if exists(select 1 from public.teams where championship_id=c.id and manager_user_id=auth.uid()) then raise exception 'Você já é responsável por um time neste campeonato.'; end if;
  if (select count(*) from public.teams where championship_id=c.id)>=c.max_teams then raise exception 'O limite de vagas foi atingido.'; end if;
  new.name:=trim(new.name); new.short_name:=nullif(upper(trim(new.short_name)),'');new.city:=nullif(trim(new.city),'');new.created_at:=now();
 else
  if not private.owns_championship(c.id) then raise exception 'Somente o organizador pode analisar inscrições.'; end if;
  if old.status<>'pending' or new.status not in ('approved','rejected') then raise exception 'Esta inscrição já foi analisada.'; end if;
  if (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then raise exception 'Altere somente a decisão da inscrição.'; end if;
  if new.status='approved' then
   if c.status<>'aberto' or not c.requires_team_approval then raise exception 'Reabra as inscrições para aprovar times.'; end if;
   if not exists(select 1 from public.championship_members where championship_id=c.id and user_id=new.requested_by) then raise exception 'O solicitante saiu do campeonato.'; end if;
   if exists(select 1 from public.teams where championship_id=c.id and manager_user_id=new.requested_by) then raise exception 'O solicitante já possui um time.'; end if;
   insert into public.teams(championship_id,name,short_name,city,manager_user_id)
    values(c.id,new.name,new.short_name,new.city,new.requested_by) returning id into new.approved_team_id;
  end if;
  new.reviewed_at:=now();
 end if;
 return new;
end; $$;
revoke all on function private.guard_team_request() from public,anon,authenticated;
create trigger guard_team_request before insert or update on public.team_requests for each row execute function private.guard_team_request();

create or replace function private.guard_team_admission()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.championship_id::text,0));
 if not private.owns_championship(new.championship_id) and exists(select 1 from public.championships where id=new.championship_id and requires_team_approval) then raise exception 'Envie uma solicitação em Inscrições. O organizador precisa aprovar seu time.'; end if;
 return new;
end; $$;
revoke all on function private.guard_team_admission() from public,anon,authenticated;
create trigger guard_team_admission before insert on public.teams for each row execute function private.guard_team_admission();

create or replace function public.create_championship_edition(p_source uuid,p_name text,p_copy_teams boolean default true)
returns uuid language plpgsql security invoker set search_path='' as $$
declare source public.championships; target uuid;
begin
 if auth.uid() is null or not private.owns_championship(p_source) then raise exception 'Somente o organizador pode criar uma edição deste campeonato.'; end if;
 if p_name is null or length(trim(p_name))<3 or length(trim(p_name))>100 then raise exception 'Use um nome de 3 a 100 caracteres.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_source::text,0));
 select * into source from public.championships where id=p_source;
 insert into public.championships(owner_id,name,sport,format,status,max_teams,regulations,requires_team_approval,is_public)
 values(auth.uid(),trim(p_name),source.sport,source.format,'rascunho',source.max_teams,source.regulations,source.requires_team_approval,false) returning id into target;
 if p_copy_teams then
  insert into public.teams(championship_id,name,short_name,city)
   select target,name,short_name,city from public.teams where championship_id=p_source order by id;
 end if;
 return target;
end; $$;
revoke all on function public.create_championship_edition(uuid,text,boolean) from public,anon;
grant execute on function public.create_championship_edition(uuid,text,boolean) to authenticated;
notify pgrst,'reload schema';

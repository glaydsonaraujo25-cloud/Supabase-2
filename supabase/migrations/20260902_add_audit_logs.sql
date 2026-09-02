create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  entity text not null,
  action text not null,
  record_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_admin_select" on public.audit_logs;
create policy "audit_admin_select"
on public.audit_logs for select to authenticated
using (private.is_admin());

grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

create or replace function public.capture_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record_id uuid;
  v_details jsonb;
begin
  if tg_op = 'DELETE' then
    v_record_id := old.id;
    v_details := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'INSERT' then
    v_record_id := new.id;
    v_details := jsonb_build_object('new', to_jsonb(new));
  else
    v_record_id := new.id;
    v_details := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  end if;

  insert into public.audit_logs(actor_id, entity, action, record_id, details)
  values (auth.uid(), tg_table_name, lower(tg_op), v_record_id, v_details);

  return coalesce(new, old);
end;
$$;

revoke all on function public.capture_audit_log() from public, anon;
grant execute on function public.capture_audit_log() to authenticated, service_role;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['soldiers','service_types','shifts','unavailabilities','swap_requests'] loop
    execute format('drop trigger if exists audit_%I on public.%I', tbl, tbl);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.capture_audit_log()', tbl, tbl);
  end loop;
end $$;

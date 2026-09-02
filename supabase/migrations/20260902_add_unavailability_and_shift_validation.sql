create type public.unavailability_type as enum ('ferias', 'missao', 'curso', 'afastamento', 'dispensa', 'outro');

create table public.unavailabilities (
  id uuid primary key default gen_random_uuid(),
  soldier_id uuid not null references public.soldiers(id) on delete cascade,
  type public.unavailability_type not null default 'outro',
  start_date date not null,
  end_date date not null,
  reason text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint unavailability_valid_period check (end_date >= start_date)
);

create index unavailabilities_soldier_period_idx
on public.unavailabilities(soldier_id, start_date, end_date);

alter table public.unavailabilities enable row level security;

grant select, insert, update, delete on public.unavailabilities to authenticated;
grant all on public.unavailabilities to service_role;

create policy "unavailabilities_select_authenticated"
on public.unavailabilities for select to authenticated
using (true);

create policy "unavailabilities_admin_insert"
on public.unavailabilities for insert to authenticated
with check (private.is_admin());

create policy "unavailabilities_admin_update"
on public.unavailabilities for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "unavailabilities_admin_delete"
on public.unavailabilities for delete to authenticated
using (private.is_admin());

create or replace function private.validate_shift_availability()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelado' then
    return new;
  end if;

  if exists (
    select 1
    from public.unavailabilities u
    where u.soldier_id = new.soldier_id
      and new.service_date between u.start_date and u.end_date
  ) then
    raise exception 'Militar indisponível nesta data.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.shifts s
    where s.soldier_id = new.soldier_id
      and s.service_date = new.service_date
      and s.status <> 'cancelado'
      and s.id <> new.id
  ) then
    raise exception 'Militar já possui serviço ativo nesta data.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger validate_shift_availability_before_write
before insert or update of soldier_id, service_date, status on public.shifts
for each row execute function private.validate_shift_availability();

-- Escala de Serviço - Supabase schema
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.app_role as enum ('admin', 'usuario');
create type public.shift_status as enum ('planejado', 'confirmado', 'concluido', 'cancelado');
create type public.swap_status as enum ('pendente', 'aprovada', 'recusada', 'cancelada');

create table public.soldiers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  rank text not null,
  war_name text,
  organization text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'usuario',
  soldier_id uuid unique references public.soldiers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  default_start time,
  default_end time,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  soldier_id uuid not null references public.soldiers(id) on delete restrict,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  service_date date not null,
  start_time time not null,
  end_time time not null,
  status public.shift_status not null default 'planejado',
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (soldier_id, service_date, start_time)
);

create table public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  target_soldier_id uuid references public.soldiers(id) on delete set null,
  reason text not null,
  status public.swap_status not null default 'pendente',
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index shifts_service_date_idx on public.shifts(service_date);
create index shifts_soldier_id_idx on public.shifts(soldier_id);
create index swap_requests_requester_idx on public.swap_requests(requester_id);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger soldiers_updated_at before update on public.soldiers
for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger shifts_updated_at before update on public.shifts
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.soldiers enable row level security;
alter table public.service_types enable row level security;
alter table public.shifts enable row level security;
alter table public.swap_requests enable row level security;

create policy "profiles_select_authenticated"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_admin());

-- Somente administradores podem alterar perfil, vínculo e papel.
create policy "profiles_admin_update"
on public.profiles for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "soldiers_select_authenticated"
on public.soldiers for select to authenticated using (true);
create policy "soldiers_admin_insert"
on public.soldiers for insert to authenticated with check (private.is_admin());
create policy "soldiers_admin_update"
on public.soldiers for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "soldiers_admin_delete"
on public.soldiers for delete to authenticated using (private.is_admin());

create policy "service_types_select_authenticated"
on public.service_types for select to authenticated using (true);
create policy "service_types_admin_insert"
on public.service_types for insert to authenticated with check (private.is_admin());
create policy "service_types_admin_update"
on public.service_types for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "service_types_admin_delete"
on public.service_types for delete to authenticated using (private.is_admin());

create policy "shifts_select_authenticated"
on public.shifts for select to authenticated using (true);
create policy "shifts_admin_insert"
on public.shifts for insert to authenticated with check (private.is_admin());
create policy "shifts_admin_update"
on public.shifts for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "shifts_admin_delete"
on public.shifts for delete to authenticated using (private.is_admin());

create policy "swap_select_own_or_admin"
on public.swap_requests for select to authenticated
using (requester_id = (select auth.uid()) or private.is_admin());

create policy "swap_insert_own"
on public.swap_requests for insert to authenticated
with check (
  requester_id = (select auth.uid())
  and exists (
    select 1
    from public.shifts s
    join public.profiles p on p.soldier_id = s.soldier_id
    where s.id = shift_id and p.id = (select auth.uid())
  )
);

-- Revisão de pedidos fica exclusivamente com o administrador.
create policy "swap_admin_update"
on public.swap_requests for update to authenticated
using (private.is_admin()) with check (private.is_admin());

-- Data API permissions. RLS continua sendo a barreira de autorização por linha.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.soldiers to authenticated;
grant select, insert, update, delete on public.service_types to authenticated;
grant select, insert, update, delete on public.shifts to authenticated;
grant select, insert, update on public.swap_requests to authenticated;
grant all on public.profiles, public.soldiers, public.service_types, public.shifts, public.swap_requests to service_role;

-- Serviços iniciais de exemplo.
insert into public.service_types (name, description, default_start, default_end)
values
  ('Serviço 24h', 'Escala administrativa de 24 horas', '08:00', '08:00'),
  ('Pernoite', 'Turno noturno administrativo', '18:00', '06:00'),
  ('Expediente', 'Apoio em horário de expediente', '08:00', '17:00')
on conflict (name) do nothing;

-- IMPORTANTE: após criar sua primeira conta, promova-a manualmente UMA VEZ no SQL Editor:
-- update public.profiles set role = 'admin' where id = 'UUID_DO_USUARIO';

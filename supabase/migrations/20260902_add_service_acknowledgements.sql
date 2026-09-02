create table if not exists public.service_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (shift_id, user_id)
);

create index if not exists service_ack_shift_idx on public.service_acknowledgements(shift_id);
create index if not exists service_ack_user_idx on public.service_acknowledgements(user_id);

alter table public.service_acknowledgements enable row level security;

drop policy if exists "service_ack_select_own_or_admin" on public.service_acknowledgements;
create policy "service_ack_select_own_or_admin"
on public.service_acknowledgements for select to authenticated
using (user_id = auth.uid() or private.is_admin());

drop policy if exists "service_ack_insert_own_assignment" on public.service_acknowledgements;
create policy "service_ack_insert_own_assignment"
on public.service_acknowledgements for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.shifts s
    join public.profiles p on p.soldier_id = s.soldier_id
    where s.id = shift_id
      and p.id = auth.uid()
      and s.status <> 'cancelado'
  )
);

drop policy if exists "service_ack_delete_own_or_admin" on public.service_acknowledgements;
create policy "service_ack_delete_own_or_admin"
on public.service_acknowledgements for delete to authenticated
using (user_id = auth.uid() or private.is_admin());

grant select, insert, delete on public.service_acknowledgements to authenticated;
grant all on public.service_acknowledgements to service_role;

drop trigger if exists audit_service_acknowledgements on public.service_acknowledgements;
create trigger audit_service_acknowledgements
after insert or delete on public.service_acknowledgements
for each row execute function public.capture_audit_log();

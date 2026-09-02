-- Completa o fluxo de troca de serviço.
-- O militar indicado aceita/recusa e, somente após aceite, o administrador pode aprovar.
-- Ao aprovar, a escala é transferida automaticamente para o substituto.

alter table public.swap_requests
  add column if not exists target_accepted boolean,
  add column if not exists target_responded_at timestamptz;

drop policy if exists "swap_select_own_or_admin" on public.swap_requests;
drop policy if exists "swap_select_participants_or_admin" on public.swap_requests;
create policy "swap_select_participants_or_admin"
on public.swap_requests for select to authenticated
using (
  requester_id = (select auth.uid())
  or private.is_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.soldier_id = target_soldier_id
  )
);

drop policy if exists "swap_target_update_response" on public.swap_requests;
create policy "swap_target_update_response"
on public.swap_requests for update to authenticated
using (
  status = 'pendente'
  and target_soldier_id is not null
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.soldier_id = target_soldier_id
  )
)
with check (
  target_soldier_id is not null
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.soldier_id = target_soldier_id
  )
);

create or replace function public.guard_swap_target_update()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $guard$
declare
  v_soldier_id uuid;
begin
  if private.is_admin() then
    return new;
  end if;

  select soldier_id into v_soldier_id
  from public.profiles
  where id = auth.uid();

  if old.target_soldier_id is null or old.target_soldier_id is distinct from v_soldier_id then
    raise exception 'Apenas o militar indicado pode responder a esta troca.';
  end if;

  if row(new.shift_id, new.requester_id, new.target_soldier_id, new.reason, new.status, new.admin_note, new.reviewed_by, new.created_at, new.reviewed_at)
     is distinct from
     row(old.shift_id, old.requester_id, old.target_soldier_id, old.reason, old.status, old.admin_note, old.reviewed_by, old.created_at, old.reviewed_at) then
    raise exception 'Você só pode aceitar ou recusar a solicitação.';
  end if;

  if new.target_accepted is null then
    raise exception 'Informe se aceita ou recusa a troca.';
  end if;

  new.target_responded_at := now();
  return new;
end;
$guard$;

drop trigger if exists swap_target_response_guard on public.swap_requests;
create trigger swap_target_response_guard
before update on public.swap_requests
for each row execute function public.guard_swap_target_update();

create or replace function public.apply_approved_swap()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $apply$
begin
  if new.status = 'aprovada'::public.swap_status
     and old.status is distinct from 'aprovada'::public.swap_status then
    if new.target_soldier_id is null then
      raise exception 'Defina um militar substituto antes de aprovar a troca.';
    end if;

    if new.target_accepted is distinct from true then
      raise exception 'O militar substituto ainda não aceitou a troca.';
    end if;

    update public.shifts
    set soldier_id = new.target_soldier_id,
        updated_at = now()
    where id = new.shift_id;
  end if;

  return new;
end;
$apply$;

drop trigger if exists apply_approved_swap_trigger on public.swap_requests;
create trigger apply_approved_swap_trigger
after update on public.swap_requests
for each row execute function public.apply_approved_swap();

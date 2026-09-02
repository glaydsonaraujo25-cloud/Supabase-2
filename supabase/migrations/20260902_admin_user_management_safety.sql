alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_profile_email_on_auth_user on auth.users;
create trigger sync_profile_email_on_auth_user
after update of email on auth.users
for each row execute function private.sync_profile_email();

create or replace function private.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  admin_count integer;
begin
  if old.role = 'admin' and new.role <> 'admin' then
    select count(*) into admin_count from public.profiles where role = 'admin';
    if admin_count <= 1 then
      raise exception 'Não é possível rebaixar o último administrador do sistema.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_last_admin_on_profiles on public.profiles;
create trigger protect_last_admin_on_profiles
before update of role on public.profiles
for each row execute function private.protect_last_admin();

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles
after update on public.profiles
for each row execute function public.capture_audit_log();

-- Append-only audit history scoped to a championship.
alter table public.audit_logs add column if not exists championship_id uuid;
create index if not exists audit_logs_championship_created_idx on public.audit_logs(championship_id,created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id);

drop policy if exists audit_admin_select on public.audit_logs;
drop policy if exists championship_owners_select_audit on public.audit_logs;
create policy championship_owners_select_audit on public.audit_logs for select to authenticated
using(private.is_admin() or (championship_id is not null and private.owns_championship(championship_id)));
grant select on public.audit_logs to authenticated;
revoke insert,update,delete,truncate on public.audit_logs from anon,authenticated;

create or replace function private.audit_championship_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare source jsonb; before_data jsonb; after_data jsonb; champ uuid; row_id uuid;
begin
 if tg_op='UPDATE' and to_jsonb(old)=to_jsonb(new) then return new; end if;
 source:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 row_id:=(source->>'id')::uuid;
 if tg_table_name='championships' then champ:=row_id;
 elsif tg_table_name in ('teams','matches','match_events') then champ:=(source->>'championship_id')::uuid;
 elsif tg_table_name='players' then select championship_id into champ from public.teams where id=(source->>'team_id')::uuid;
 else return coalesce(new,old); end if;
 before_data:=case when tg_op in ('UPDATE','DELETE') then to_jsonb(old)-array['invite_code','owner_id','manager_user_id','championship_id','created_at','updated_at'] else null end;
 after_data:=case when tg_op in ('UPDATE','INSERT') then to_jsonb(new)-array['invite_code','owner_id','manager_user_id','championship_id','created_at','updated_at'] else null end;
 insert into public.audit_logs(actor_id,entity,action,record_id,championship_id,details)
 values(auth.uid(),tg_table_name,lower(tg_op),row_id,champ,jsonb_strip_nulls(jsonb_build_object('before',before_data,'after',after_data)));
 return coalesce(new,old);
end; $$;
revoke all on function private.audit_championship_change() from public,anon,authenticated;

do $$ declare name text; begin
 foreach name in array array['championships','teams','players','matches','match_events'] loop
  execute format('drop trigger if exists audit_championship_change on public.%I',name);
  execute format('create trigger audit_championship_change before insert or update or delete on public.%I for each row execute function private.audit_championship_change()',name);
 end loop;
end $$;
notify pgrst,'reload schema';

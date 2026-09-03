-- Index-only maintenance. No rows, constraints or RLS policies are changed.
-- Small tables were checked before applying. Fail quickly on lock contention.
begin;
set local lock_timeout = '3s';
create index if not exists matches_home_team_idx on public.matches(home_team_id);
create index if not exists matches_away_team_idx on public.matches(away_team_id);
create index if not exists shifts_created_by_idx on public.shifts(created_by);
create index if not exists shifts_service_type_idx on public.shifts(service_type_id);
create index if not exists swap_requests_reviewed_by_idx on public.swap_requests(reviewed_by);
create index if not exists swap_requests_shift_idx on public.swap_requests(shift_id);
create index if not exists swap_requests_target_soldier_idx on public.swap_requests(target_soldier_id);
create index if not exists unavailabilities_created_by_idx on public.unavailabilities(created_by);

-- Preserve the snapshot's indexes. Remove only their verified identical copies.
do $$
declare duplicate_name text; retained_name text; duplicate_id regclass; retained_id regclass;
begin
 for duplicate_name,retained_name in select * from (values
  ('idx_championship_members_championship_id','championship_members_championship_idx'),
  ('idx_championship_members_user_id','championship_members_user_idx')
 ) as pairs(duplicate_name,retained_name) loop
  duplicate_id:=to_regclass('public.'||duplicate_name);
  retained_id:=to_regclass('public.'||retained_name);
  if duplicate_id is null then continue; end if;
  if retained_id is null or not exists (
   select 1 from pg_index d join pg_index r on r.indexrelid=retained_id
   where d.indexrelid=duplicate_id and d.indrelid=r.indrelid
    and d.indkey=r.indkey and d.indclass=r.indclass and d.indcollation=r.indcollation
    and d.indoption=r.indoption and d.indnkeyatts=r.indnkeyatts
    and d.indpred is null and r.indpred is null
    and d.indexprs is null and r.indexprs is null
    and not d.indisunique and not d.indisprimary and not d.indisexclusion
    and r.indisvalid and r.indisready
  ) then raise exception 'Index definitions differ; review % manually.',duplicate_name;
  end if;
  execute format('drop index public.%I',duplicate_name);
 end loop;
end $$;
commit;

-- Bracketly: snapshot do banco existente, sem dados de usuários.
-- Apenas para projeto Supabase vazio. Execute também upgrades/championship_integrity.sql.
-- Inclui tabelas legadas para preservar compatibilidade; a interface usa campeonatos.
begin;
set local search_path=public;
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create type public."app_role" as enum ('admin','usuario');
create type public."shift_status" as enum ('planejado','confirmado','concluido','cancelado');
create type public."swap_status" as enum ('pendente','aprovada','recusada','cancelada');
create type public."unavailability_type" as enum ('ferias','missao','curso','afastamento','dispensa','outro');
create table public."swap_requests" (
 "id" uuid default gen_random_uuid() not null,
 "shift_id" uuid not null,
 "requester_id" uuid default auth.uid() not null,
 "target_soldier_id" uuid,
 "reason" text not null,
 "status" swap_status default 'pendente'::swap_status not null,
 "admin_note" text,
 "reviewed_by" uuid,
 "created_at" timestamp with time zone default now() not null,
 "reviewed_at" timestamp with time zone,
 "target_accepted" boolean,
 "target_responded_at" timestamp with time zone
);
create table public."profiles" (
 "id" uuid not null,
 "full_name" text default ''::text not null,
 "role" app_role default 'usuario'::app_role not null,
 "soldier_id" uuid,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "email" text
);
create table public."soldiers" (
 "id" uuid default gen_random_uuid() not null,
 "full_name" text not null,
 "rank" text not null,
 "war_name" text,
 "organization" text,
 "phone" text,
 "active" boolean default true not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."service_types" (
 "id" uuid default gen_random_uuid() not null,
 "name" text not null,
 "description" text,
 "default_start" time without time zone,
 "default_end" time without time zone,
 "active" boolean default true not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."shifts" (
 "id" uuid default gen_random_uuid() not null,
 "soldier_id" uuid not null,
 "service_type_id" uuid not null,
 "service_date" date not null,
 "start_time" time without time zone not null,
 "end_time" time without time zone not null,
 "status" shift_status default 'planejado'::shift_status not null,
 "notes" text,
 "created_by" uuid default auth.uid() not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."unavailabilities" (
 "id" uuid default gen_random_uuid() not null,
 "soldier_id" uuid not null,
 "type" unavailability_type default 'outro'::unavailability_type not null,
 "start_date" date not null,
 "end_date" date not null,
 "reason" text,
 "created_by" uuid default auth.uid() not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."audit_logs" (
 "id" uuid default gen_random_uuid() not null,
 "actor_id" uuid,
 "entity" text not null,
 "action" text not null,
 "record_id" uuid,
 "details" jsonb default '{}'::jsonb not null,
 "created_at" timestamp with time zone default now() not null
);
create table public."championships" (
 "id" uuid default gen_random_uuid() not null,
 "owner_id" uuid not null,
 "name" text not null,
 "sport" text default 'Futebol'::text not null,
 "format" text default 'Pontos corridos'::text not null,
 "status" text default 'rascunho'::text not null,
 "start_date" date,
 "end_date" date,
 "max_teams" integer default 8 not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "invite_code" text default upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8)) not null,
 "is_public" boolean default false not null,
 "public_slug" text not null
);
create table public."teams" (
 "id" uuid default gen_random_uuid() not null,
 "championship_id" uuid not null,
 "name" text not null,
 "short_name" text,
 "city" text,
 "created_at" timestamp with time zone default now() not null,
 "manager_user_id" uuid
);
create table public."match_events" (
 "id" uuid default gen_random_uuid() not null,
 "championship_id" uuid not null,
 "match_id" uuid not null,
 "team_id" uuid not null,
 "player_id" uuid,
 "event_type" text not null,
 "minute" smallint,
 "created_at" timestamp with time zone default now() not null
);
create table public."championship_members" (
 "id" uuid default gen_random_uuid() not null,
 "championship_id" uuid not null,
 "user_id" uuid not null,
 "role" text default 'participant'::text not null,
 "joined_at" timestamp with time zone default now() not null
);
create table public."matches" (
 "id" uuid default gen_random_uuid() not null,
 "championship_id" uuid not null,
 "home_team_id" uuid not null,
 "away_team_id" uuid not null,
 "round" integer default 1 not null,
 "scheduled_at" timestamp with time zone,
 "status" text default 'agendado'::text not null,
 "home_score" integer,
 "away_score" integer,
 "created_at" timestamp with time zone default now() not null,
 "bracket_stage" text,
 "bracket_position" integer,
 "penalty_home_score" integer,
 "penalty_away_score" integer
);
create table public."players" (
 "id" uuid default gen_random_uuid() not null,
 "team_id" uuid not null,
 "name" text not null,
 "shirt_number" integer,
 "position" text,
 "created_at" timestamp with time zone default now() not null
);
alter table public."championship_members" add constraint "championship_members_championship_id_user_id_key" UNIQUE (championship_id, user_id);
alter table public."soldiers" add constraint "soldiers_pkey" PRIMARY KEY (id);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."profiles" add constraint "profiles_soldier_id_key" UNIQUE (soldier_id);
alter table public."service_types" add constraint "service_types_pkey" PRIMARY KEY (id);
alter table public."service_types" add constraint "service_types_name_key" UNIQUE (name);
alter table public."shifts" add constraint "shifts_pkey" PRIMARY KEY (id);
alter table public."shifts" add constraint "shifts_soldier_id_service_date_start_time_key" UNIQUE (soldier_id, service_date, start_time);
alter table public."swap_requests" add constraint "swap_requests_pkey" PRIMARY KEY (id);
alter table public."unavailabilities" add constraint "unavailability_valid_period" CHECK ((end_date >= start_date));
alter table public."unavailabilities" add constraint "unavailabilities_pkey" PRIMARY KEY (id);
alter table public."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY (id);
alter table public."championships" add constraint "championships_name_check" CHECK (((char_length(name) >= 3) AND (char_length(name) <= 80)));
alter table public."championships" add constraint "championships_format_check" CHECK ((format = ANY (ARRAY['Pontos corridos'::text, 'Mata-mata'::text, 'Grupos + mata-mata'::text])));
alter table public."championships" add constraint "championships_status_check" CHECK ((status = ANY (ARRAY['rascunho'::text, 'aberto'::text, 'em_andamento'::text, 'finalizado'::text])));
alter table public."championships" add constraint "championships_max_teams_check" CHECK (((max_teams >= 2) AND (max_teams <= 64)));
alter table public."championships" add constraint "championship_dates_valid" CHECK (((end_date IS NULL) OR (start_date IS NULL) OR (end_date >= start_date)));
alter table public."championships" add constraint "championships_pkey" PRIMARY KEY (id);
alter table public."teams" add constraint "teams_name_check" CHECK (((char_length(name) >= 2) AND (char_length(name) <= 60)));
alter table public."teams" add constraint "teams_short_name_check" CHECK (((short_name IS NULL) OR ((char_length(short_name) >= 2) AND (char_length(short_name) <= 5))));
alter table public."teams" add constraint "teams_pkey" PRIMARY KEY (id);
alter table public."teams" add constraint "teams_championship_id_name_key" UNIQUE (championship_id, name);
alter table public."championship_members" add constraint "championship_members_role_check" CHECK ((role = ANY (ARRAY['participant'::text, 'organizer'::text])));
alter table public."players" add constraint "players_name_check" CHECK (((char_length(name) >= 2) AND (char_length(name) <= 80)));
alter table public."players" add constraint "players_shirt_number_check" CHECK (((shirt_number IS NULL) OR ((shirt_number >= 0) AND (shirt_number <= 99))));
alter table public."players" add constraint "players_pkey" PRIMARY KEY (id);
alter table public."matches" add constraint "matches_round_check" CHECK ((round > 0));
alter table public."matches" add constraint "matches_status_check" CHECK ((status = ANY (ARRAY['agendado'::text, 'em_andamento'::text, 'finalizado'::text, 'cancelado'::text])));
alter table public."matches" add constraint "matches_home_score_check" CHECK (((home_score IS NULL) OR (home_score >= 0)));
alter table public."matches" add constraint "matches_away_score_check" CHECK (((away_score IS NULL) OR (away_score >= 0)));
alter table public."matches" add constraint "different_teams" CHECK ((home_team_id <> away_team_id));
alter table public."matches" add constraint "matches_pkey" PRIMARY KEY (id);
alter table public."championship_members" add constraint "championship_members_pkey" PRIMARY KEY (id);
alter table public."match_events" add constraint "match_events_event_type_check" CHECK ((event_type = ANY (ARRAY['goal'::text, 'assist'::text, 'yellow_card'::text, 'red_card'::text])));
alter table public."match_events" add constraint "match_events_minute_check" CHECK (((minute IS NULL) OR ((minute >= 0) AND (minute <= 150))));
alter table public."match_events" add constraint "match_events_pkey" PRIMARY KEY (id);
alter table public."matches" add constraint "matches_bracket_position_check" CHECK (((bracket_position IS NULL) OR (bracket_position > 0)));
alter table public."matches" add constraint "matches_penalty_home_score_check" CHECK (((penalty_home_score IS NULL) OR (penalty_home_score >= 0)));
alter table public."matches" add constraint "matches_penalty_away_score_check" CHECK (((penalty_away_score IS NULL) OR (penalty_away_score >= 0)));
alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."profiles" add constraint "profiles_soldier_id_fkey" FOREIGN KEY (soldier_id) REFERENCES soldiers(id) ON DELETE SET NULL;
alter table public."shifts" add constraint "shifts_soldier_id_fkey" FOREIGN KEY (soldier_id) REFERENCES soldiers(id) ON DELETE RESTRICT;
alter table public."shifts" add constraint "shifts_service_type_id_fkey" FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE RESTRICT;
alter table public."shifts" add constraint "shifts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."swap_requests" add constraint "swap_requests_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE;
alter table public."swap_requests" add constraint "swap_requests_requester_id_fkey" FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."swap_requests" add constraint "swap_requests_target_soldier_id_fkey" FOREIGN KEY (target_soldier_id) REFERENCES soldiers(id) ON DELETE SET NULL;
alter table public."swap_requests" add constraint "swap_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."unavailabilities" add constraint "unavailabilities_soldier_id_fkey" FOREIGN KEY (soldier_id) REFERENCES soldiers(id) ON DELETE CASCADE;
alter table public."unavailabilities" add constraint "unavailabilities_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."audit_logs" add constraint "audit_logs_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."teams" add constraint "teams_manager_user_id_fkey" FOREIGN KEY (manager_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."championship_members" add constraint "championship_members_championship_id_fkey" FOREIGN KEY (championship_id) REFERENCES championships(id) ON DELETE CASCADE;
alter table public."championship_members" add constraint "championship_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."championships" add constraint "championships_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."teams" add constraint "teams_championship_id_fkey" FOREIGN KEY (championship_id) REFERENCES championships(id) ON DELETE CASCADE;
alter table public."players" add constraint "players_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public."matches" add constraint "matches_championship_id_fkey" FOREIGN KEY (championship_id) REFERENCES championships(id) ON DELETE CASCADE;
alter table public."matches" add constraint "matches_home_team_id_fkey" FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public."matches" add constraint "matches_away_team_id_fkey" FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public."match_events" add constraint "match_events_championship_id_fkey" FOREIGN KEY (championship_id) REFERENCES championships(id) ON DELETE CASCADE;
alter table public."match_events" add constraint "match_events_match_id_fkey" FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;
alter table public."match_events" add constraint "match_events_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
alter table public."match_events" add constraint "match_events_player_id_fkey" FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;
CREATE INDEX shifts_soldier_id_idx ON public.shifts USING btree (soldier_id);
CREATE INDEX swap_requests_requester_idx ON public.swap_requests USING btree (requester_id);
CREATE INDEX unavailabilities_soldier_period_idx ON public.unavailabilities USING btree (soldier_id, start_date, end_date);
CREATE INDEX shifts_service_date_idx ON public.shifts USING btree (service_date);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs USING btree (entity);
CREATE INDEX championships_owner_idx ON public.championships USING btree (owner_id);
CREATE INDEX teams_championship_idx ON public.teams USING btree (championship_id);
CREATE INDEX players_team_idx ON public.players USING btree (team_id);
CREATE INDEX matches_championship_idx ON public.matches USING btree (championship_id);
CREATE INDEX idx_teams_manager_user_id ON public.teams USING btree (manager_user_id);
CREATE UNIQUE INDEX championships_public_slug_key ON public.championships USING btree (public_slug);
CREATE UNIQUE INDEX championships_invite_code_key ON public.championships USING btree (invite_code);
CREATE INDEX championships_public_lookup_idx ON public.championships USING btree (is_public, public_slug);
CREATE UNIQUE INDEX teams_one_manager_per_championship ON public.teams USING btree (championship_id, manager_user_id) WHERE (manager_user_id IS NOT NULL);
CREATE INDEX championship_members_user_idx ON public.championship_members USING btree (user_id);
CREATE INDEX championship_members_championship_idx ON public.championship_members USING btree (championship_id);
CREATE INDEX matches_championship_bracket_stage_idx ON public.matches USING btree (championship_id, bracket_stage, bracket_position);
CREATE INDEX idx_championship_members_user_id ON public.championship_members USING btree (user_id);
CREATE INDEX idx_championship_members_championship_id ON public.championship_members USING btree (championship_id);
CREATE INDEX match_events_championship_idx ON public.match_events USING btree (championship_id);
CREATE INDEX match_events_match_idx ON public.match_events USING btree (match_id);
CREATE INDEX match_events_player_idx ON public.match_events USING btree (player_id);
CREATE INDEX match_events_team_idx ON public.match_events USING btree (team_id);
CREATE OR REPLACE FUNCTION private.sync_profile_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_swap_target_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$function$
;
CREATE OR REPLACE FUNCTION private.protect_last_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION private.validate_shift_availability()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.join_championship_by_code(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_championship uuid;
begin
  if v_user is null then raise exception 'Você precisa estar autenticado.'; end if;
  select c.id into v_championship
  from public.championships c
  where upper(c.invite_code)=upper(trim(p_code)) and c.status in ('aberto','em_andamento')
  limit 1;
  if v_championship is null then raise exception 'Código inválido ou campeonato indisponível.'; end if;
  insert into public.championship_members(championship_id,user_id,role)
  values(v_championship,v_user,'participant')
  on conflict(championship_id,user_id) do nothing;
  return v_championship;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.capture_audit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.apply_approved_swap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status = 'aprovada'::public.swap_status and old.status is distinct from 'aprovada'::public.swap_status then
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
$function$
;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();
CREATE TRIGGER soldiers_updated_at BEFORE UPDATE ON public.soldiers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER validate_shift_availability_before_write BEFORE INSERT OR UPDATE OF soldier_id, service_date, status ON public.shifts FOR EACH ROW EXECUTE FUNCTION private.validate_shift_availability();
CREATE TRIGGER swap_target_response_guard BEFORE UPDATE ON public.swap_requests FOR EACH ROW EXECUTE FUNCTION guard_swap_target_update();
CREATE TRIGGER apply_approved_swap_trigger AFTER UPDATE ON public.swap_requests FOR EACH ROW EXECUTE FUNCTION apply_approved_swap();
CREATE TRIGGER audit_soldiers AFTER INSERT OR DELETE OR UPDATE ON public.soldiers FOR EACH ROW EXECUTE FUNCTION capture_audit_log();
CREATE TRIGGER audit_service_types AFTER INSERT OR DELETE OR UPDATE ON public.service_types FOR EACH ROW EXECUTE FUNCTION capture_audit_log();
CREATE TRIGGER audit_shifts AFTER INSERT OR DELETE OR UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION capture_audit_log();
CREATE TRIGGER audit_unavailabilities AFTER INSERT OR DELETE OR UPDATE ON public.unavailabilities FOR EACH ROW EXECUTE FUNCTION capture_audit_log();
CREATE TRIGGER audit_swap_requests AFTER INSERT OR DELETE OR UPDATE ON public.swap_requests FOR EACH ROW EXECUTE FUNCTION capture_audit_log();
CREATE TRIGGER sync_profile_email_on_auth_user AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION private.sync_profile_email();
CREATE TRIGGER protect_last_admin_on_profiles BEFORE UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.protect_last_admin();
CREATE TRIGGER audit_profiles AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION capture_audit_log();
alter table public."swap_requests" enable row level security;
revoke all on public."swap_requests" from anon,authenticated;
alter table public."profiles" enable row level security;
revoke all on public."profiles" from anon,authenticated;
alter table public."soldiers" enable row level security;
revoke all on public."soldiers" from anon,authenticated;
alter table public."service_types" enable row level security;
revoke all on public."service_types" from anon,authenticated;
alter table public."shifts" enable row level security;
revoke all on public."shifts" from anon,authenticated;
alter table public."unavailabilities" enable row level security;
revoke all on public."unavailabilities" from anon,authenticated;
alter table public."audit_logs" enable row level security;
revoke all on public."audit_logs" from anon,authenticated;
alter table public."championships" enable row level security;
revoke all on public."championships" from anon,authenticated;
alter table public."teams" enable row level security;
revoke all on public."teams" from anon,authenticated;
alter table public."match_events" enable row level security;
revoke all on public."match_events" from anon,authenticated;
alter table public."championship_members" enable row level security;
revoke all on public."championship_members" from anon,authenticated;
alter table public."matches" enable row level security;
revoke all on public."matches" from anon,authenticated;
alter table public."players" enable row level security;
revoke all on public."players" from anon,authenticated;
create policy "profiles_select_authenticated" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using (((id = ( SELECT auth.uid() AS uid)) OR private.is_admin()));
create policy "profiles_admin_update" on public."profiles" as PERMISSIVE for UPDATE to "authenticated" using (private.is_admin()) with check (private.is_admin());
create policy "soldiers_select_authenticated" on public."soldiers" as PERMISSIVE for SELECT to "authenticated" using (true);
create policy "soldiers_admin_insert" on public."soldiers" as PERMISSIVE for INSERT to "authenticated" with check (private.is_admin());
create policy "soldiers_admin_update" on public."soldiers" as PERMISSIVE for UPDATE to "authenticated" using (private.is_admin()) with check (private.is_admin());
create policy "soldiers_admin_delete" on public."soldiers" as PERMISSIVE for DELETE to "authenticated" using (private.is_admin());
create policy "service_types_select_authenticated" on public."service_types" as PERMISSIVE for SELECT to "authenticated" using (true);
create policy "service_types_admin_insert" on public."service_types" as PERMISSIVE for INSERT to "authenticated" with check (private.is_admin());
create policy "service_types_admin_update" on public."service_types" as PERMISSIVE for UPDATE to "authenticated" using (private.is_admin()) with check (private.is_admin());
create policy "service_types_admin_delete" on public."service_types" as PERMISSIVE for DELETE to "authenticated" using (private.is_admin());
create policy "shifts_select_authenticated" on public."shifts" as PERMISSIVE for SELECT to "authenticated" using (true);
create policy "shifts_admin_insert" on public."shifts" as PERMISSIVE for INSERT to "authenticated" with check (private.is_admin());
create policy "shifts_admin_update" on public."shifts" as PERMISSIVE for UPDATE to "authenticated" using (private.is_admin()) with check (private.is_admin());
create policy "shifts_admin_delete" on public."shifts" as PERMISSIVE for DELETE to "authenticated" using (private.is_admin());
create policy "swap_insert_own" on public."swap_requests" as PERMISSIVE for INSERT to "authenticated" with check (((requester_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (shifts s
     JOIN profiles p ON ((p.soldier_id = s.soldier_id)))
  WHERE ((s.id = swap_requests.shift_id) AND (p.id = ( SELECT auth.uid() AS uid)))))));
create policy "swap_admin_update" on public."swap_requests" as PERMISSIVE for UPDATE to "authenticated" using (private.is_admin()) with check (private.is_admin());
create policy "unavailabilities_select_authenticated" on public."unavailabilities" as PERMISSIVE for SELECT to "authenticated" using (true);
create policy "unavailabilities_admin_insert" on public."unavailabilities" as PERMISSIVE for INSERT to "authenticated" with check (private.is_admin());
create policy "unavailabilities_admin_update" on public."unavailabilities" as PERMISSIVE for UPDATE to "authenticated" using (private.is_admin()) with check (private.is_admin());
create policy "unavailabilities_admin_delete" on public."unavailabilities" as PERMISSIVE for DELETE to "authenticated" using (private.is_admin());
create policy "swap_select_participants_or_admin" on public."swap_requests" as PERMISSIVE for SELECT to "authenticated" using (((requester_id = ( SELECT auth.uid() AS uid)) OR private.is_admin() OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.soldier_id = swap_requests.target_soldier_id))))));
create policy "swap_target_update_response" on public."swap_requests" as PERMISSIVE for UPDATE to "authenticated" using (((status = 'pendente'::swap_status) AND (target_soldier_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.soldier_id = swap_requests.target_soldier_id)))))) with check (((target_soldier_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.soldier_id = swap_requests.target_soldier_id))))));
create policy "audit_admin_select" on public."audit_logs" as PERMISSIVE for SELECT to "authenticated" using (private.is_admin());
create policy "owners_insert_championships" on public."championships" as PERMISSIVE for INSERT to "authenticated" with check ((( SELECT auth.uid() AS uid) = owner_id));
create policy "owners_update_championships" on public."championships" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT auth.uid() AS uid) = owner_id)) with check ((( SELECT auth.uid() AS uid) = owner_id));
create policy "owners_delete_championships" on public."championships" as PERMISSIVE for DELETE to "authenticated" using ((( SELECT auth.uid() AS uid) = owner_id));
create policy "members_delete_own_membership" on public."championship_members" as PERMISSIVE for DELETE to "authenticated" using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "owners_or_members_select_championships" on public."championships" as PERMISSIVE for SELECT to "authenticated" using (((owner_id = ( SELECT auth.uid() AS uid)) OR (id IN ( SELECT championship_members.championship_id
   FROM championship_members
  WHERE (championship_members.user_id = ( SELECT auth.uid() AS uid))))));
create policy "championship_members_select_teams" on public."teams" as PERMISSIVE for SELECT to "authenticated" using ((championship_id IN ( SELECT championships.id
   FROM championships
  WHERE (championships.owner_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT championship_members.championship_id
   FROM championship_members
  WHERE (championship_members.user_id = ( SELECT auth.uid() AS uid)))));
create policy "owners_or_managers_insert_teams" on public."teams" as PERMISSIVE for INSERT to "authenticated" with check (((EXISTS ( SELECT 1
   FROM championships c
  WHERE ((c.id = teams.championship_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))) OR ((manager_user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM championship_members cm
  WHERE ((cm.championship_id = teams.championship_id) AND (cm.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "owners_or_managers_update_teams" on public."teams" as PERMISSIVE for UPDATE to "authenticated" using (((manager_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM championships c
  WHERE ((c.id = teams.championship_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((manager_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM championships c
  WHERE ((c.id = teams.championship_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy "owners_or_managers_delete_teams" on public."teams" as PERMISSIVE for DELETE to "authenticated" using (((manager_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM championships c
  WHERE ((c.id = teams.championship_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy "championship_members_select_players" on public."players" as PERMISSIVE for SELECT to "authenticated" using ((team_id IN ( SELECT t.id
   FROM teams t)));
create policy "owners_or_managers_insert_players" on public."players" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM (teams t
     JOIN championships c ON ((c.id = t.championship_id)))
  WHERE ((t.id = players.team_id) AND ((t.manager_user_id = ( SELECT auth.uid() AS uid)) OR (c.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy "owners_or_managers_update_players" on public."players" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM (teams t
     JOIN championships c ON ((c.id = t.championship_id)))
  WHERE ((t.id = players.team_id) AND ((t.manager_user_id = ( SELECT auth.uid() AS uid)) OR (c.owner_id = ( SELECT auth.uid() AS uid))))))) with check ((EXISTS ( SELECT 1
   FROM (teams t
     JOIN championships c ON ((c.id = t.championship_id)))
  WHERE ((t.id = players.team_id) AND ((t.manager_user_id = ( SELECT auth.uid() AS uid)) OR (c.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy "owners_or_managers_delete_players" on public."players" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM (teams t
     JOIN championships c ON ((c.id = t.championship_id)))
  WHERE ((t.id = players.team_id) AND ((t.manager_user_id = ( SELECT auth.uid() AS uid)) OR (c.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy "championship_members_select_matches" on public."matches" as PERMISSIVE for SELECT to "authenticated" using ((championship_id IN ( SELECT championships.id
   FROM championships
  WHERE (championships.owner_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT championship_members.championship_id
   FROM championship_members
  WHERE (championship_members.user_id = ( SELECT auth.uid() AS uid)))));
create policy "owners_insert_matches" on public."matches" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM championships c
  WHERE ((c.id = matches.championship_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
create policy "owners_update_matches" on public."matches" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM championships c
  WHERE ((c.id = matches.championship_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM championships c
  WHERE ((c.id = matches.championship_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
create policy "owners_delete_matches" on public."matches" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM championships c
  WHERE ((c.id = matches.championship_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
create policy "members_select_championship_members" on public."championship_members" as PERMISSIVE for SELECT to "authenticated" using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "owners_view_member_profiles" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using (((( SELECT auth.uid() AS uid) = id) OR (EXISTS ( SELECT 1
   FROM (championship_members cm
     JOIN championships c ON ((c.id = cm.championship_id)))
  WHERE ((cm.user_id = profiles.id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))));
create policy "owners_delete_championship_members" on public."championship_members" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM championships c
  WHERE ((c.id = championship_members.championship_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
create policy "public_read_public_championships" on public."championships" as PERMISSIVE for SELECT to "anon" using ((is_public = true));
create policy "public_read_public_teams" on public."teams" as PERMISSIVE for SELECT to "anon" using ((EXISTS ( SELECT 1
   FROM championships c
  WHERE ((c.id = teams.championship_id) AND (c.is_public = true)))));
create policy "public_read_public_matches" on public."matches" as PERMISSIVE for SELECT to "anon" using ((EXISTS ( SELECT 1
   FROM championships c
  WHERE ((c.id = matches.championship_id) AND (c.is_public = true)))));
create policy "public_can_read_public_match_events" on public."match_events" as PERMISSIVE for SELECT to "anon" using ((championship_id IN ( SELECT c.id
   FROM championships c
  WHERE (c.is_public = true))));
create policy "members_can_read_match_events" on public."match_events" as PERMISSIVE for SELECT to "authenticated" using ((championship_id IN ( SELECT c.id
   FROM championships c
  WHERE ((c.owner_id = ( SELECT auth.uid() AS uid)) OR (c.id IN ( SELECT cm.championship_id
           FROM championship_members cm
          WHERE (cm.user_id = ( SELECT auth.uid() AS uid))))))));
create policy "owners_can_insert_match_events" on public."match_events" as PERMISSIVE for INSERT to "authenticated" with check ((championship_id IN ( SELECT c.id
   FROM championships c
  WHERE (c.owner_id = ( SELECT auth.uid() AS uid)))));
create policy "owners_can_update_match_events" on public."match_events" as PERMISSIVE for UPDATE to "authenticated" using ((championship_id IN ( SELECT c.id
   FROM championships c
  WHERE (c.owner_id = ( SELECT auth.uid() AS uid))))) with check ((championship_id IN ( SELECT c.id
   FROM championships c
  WHERE (c.owner_id = ( SELECT auth.uid() AS uid)))));
create policy "owners_can_delete_match_events" on public."match_events" as PERMISSIVE for DELETE to "authenticated" using ((championship_id IN ( SELECT c.id
   FROM championships c
  WHERE (c.owner_id = ( SELECT auth.uid() AS uid)))));
create policy "public_can_read_public_players" on public."players" as PERMISSIVE for SELECT to "anon" using ((team_id IN ( SELECT t.id
   FROM (teams t
     JOIN championships c ON ((c.id = t.championship_id)))
  WHERE (c.is_public = true))));
grant INSERT on public."swap_requests" to "anon";
grant SELECT on public."swap_requests" to "anon";
grant UPDATE on public."swap_requests" to "anon";
grant DELETE on public."swap_requests" to "anon";
grant TRUNCATE on public."swap_requests" to "anon";
grant REFERENCES on public."swap_requests" to "anon";
grant TRIGGER on public."swap_requests" to "anon";
grant INSERT on public."swap_requests" to "authenticated";
grant SELECT on public."swap_requests" to "authenticated";
grant UPDATE on public."swap_requests" to "authenticated";
grant DELETE on public."swap_requests" to "authenticated";
grant TRUNCATE on public."swap_requests" to "authenticated";
grant REFERENCES on public."swap_requests" to "authenticated";
grant TRIGGER on public."swap_requests" to "authenticated";
grant INSERT on public."swap_requests" to "service_role";
grant SELECT on public."swap_requests" to "service_role";
grant UPDATE on public."swap_requests" to "service_role";
grant DELETE on public."swap_requests" to "service_role";
grant TRUNCATE on public."swap_requests" to "service_role";
grant REFERENCES on public."swap_requests" to "service_role";
grant TRIGGER on public."swap_requests" to "service_role";
grant INSERT on public."profiles" to "anon";
grant SELECT on public."profiles" to "anon";
grant UPDATE on public."profiles" to "anon";
grant DELETE on public."profiles" to "anon";
grant TRUNCATE on public."profiles" to "anon";
grant REFERENCES on public."profiles" to "anon";
grant TRIGGER on public."profiles" to "anon";
grant INSERT on public."profiles" to "authenticated";
grant SELECT on public."profiles" to "authenticated";
grant UPDATE on public."profiles" to "authenticated";
grant DELETE on public."profiles" to "authenticated";
grant TRUNCATE on public."profiles" to "authenticated";
grant REFERENCES on public."profiles" to "authenticated";
grant TRIGGER on public."profiles" to "authenticated";
grant INSERT on public."profiles" to "service_role";
grant SELECT on public."profiles" to "service_role";
grant UPDATE on public."profiles" to "service_role";
grant DELETE on public."profiles" to "service_role";
grant TRUNCATE on public."profiles" to "service_role";
grant REFERENCES on public."profiles" to "service_role";
grant TRIGGER on public."profiles" to "service_role";
grant INSERT on public."soldiers" to "anon";
grant SELECT on public."soldiers" to "anon";
grant UPDATE on public."soldiers" to "anon";
grant DELETE on public."soldiers" to "anon";
grant TRUNCATE on public."soldiers" to "anon";
grant REFERENCES on public."soldiers" to "anon";
grant TRIGGER on public."soldiers" to "anon";
grant INSERT on public."soldiers" to "authenticated";
grant SELECT on public."soldiers" to "authenticated";
grant UPDATE on public."soldiers" to "authenticated";
grant DELETE on public."soldiers" to "authenticated";
grant TRUNCATE on public."soldiers" to "authenticated";
grant REFERENCES on public."soldiers" to "authenticated";
grant TRIGGER on public."soldiers" to "authenticated";
grant INSERT on public."soldiers" to "service_role";
grant SELECT on public."soldiers" to "service_role";
grant UPDATE on public."soldiers" to "service_role";
grant DELETE on public."soldiers" to "service_role";
grant TRUNCATE on public."soldiers" to "service_role";
grant REFERENCES on public."soldiers" to "service_role";
grant TRIGGER on public."soldiers" to "service_role";
grant INSERT on public."service_types" to "anon";
grant SELECT on public."service_types" to "anon";
grant UPDATE on public."service_types" to "anon";
grant DELETE on public."service_types" to "anon";
grant TRUNCATE on public."service_types" to "anon";
grant REFERENCES on public."service_types" to "anon";
grant TRIGGER on public."service_types" to "anon";
grant INSERT on public."service_types" to "authenticated";
grant SELECT on public."service_types" to "authenticated";
grant UPDATE on public."service_types" to "authenticated";
grant DELETE on public."service_types" to "authenticated";
grant TRUNCATE on public."service_types" to "authenticated";
grant REFERENCES on public."service_types" to "authenticated";
grant TRIGGER on public."service_types" to "authenticated";
grant INSERT on public."service_types" to "service_role";
grant SELECT on public."service_types" to "service_role";
grant UPDATE on public."service_types" to "service_role";
grant DELETE on public."service_types" to "service_role";
grant TRUNCATE on public."service_types" to "service_role";
grant REFERENCES on public."service_types" to "service_role";
grant TRIGGER on public."service_types" to "service_role";
grant INSERT on public."shifts" to "anon";
grant SELECT on public."shifts" to "anon";
grant UPDATE on public."shifts" to "anon";
grant DELETE on public."shifts" to "anon";
grant TRUNCATE on public."shifts" to "anon";
grant REFERENCES on public."shifts" to "anon";
grant TRIGGER on public."shifts" to "anon";
grant INSERT on public."shifts" to "authenticated";
grant SELECT on public."shifts" to "authenticated";
grant UPDATE on public."shifts" to "authenticated";
grant DELETE on public."shifts" to "authenticated";
grant TRUNCATE on public."shifts" to "authenticated";
grant REFERENCES on public."shifts" to "authenticated";
grant TRIGGER on public."shifts" to "authenticated";
grant INSERT on public."shifts" to "service_role";
grant SELECT on public."shifts" to "service_role";
grant UPDATE on public."shifts" to "service_role";
grant DELETE on public."shifts" to "service_role";
grant TRUNCATE on public."shifts" to "service_role";
grant REFERENCES on public."shifts" to "service_role";
grant TRIGGER on public."shifts" to "service_role";
grant INSERT on public."unavailabilities" to "anon";
grant SELECT on public."unavailabilities" to "anon";
grant UPDATE on public."unavailabilities" to "anon";
grant DELETE on public."unavailabilities" to "anon";
grant TRUNCATE on public."unavailabilities" to "anon";
grant REFERENCES on public."unavailabilities" to "anon";
grant TRIGGER on public."unavailabilities" to "anon";
grant INSERT on public."unavailabilities" to "authenticated";
grant SELECT on public."unavailabilities" to "authenticated";
grant UPDATE on public."unavailabilities" to "authenticated";
grant DELETE on public."unavailabilities" to "authenticated";
grant TRUNCATE on public."unavailabilities" to "authenticated";
grant REFERENCES on public."unavailabilities" to "authenticated";
grant TRIGGER on public."unavailabilities" to "authenticated";
grant INSERT on public."unavailabilities" to "service_role";
grant SELECT on public."unavailabilities" to "service_role";
grant UPDATE on public."unavailabilities" to "service_role";
grant DELETE on public."unavailabilities" to "service_role";
grant TRUNCATE on public."unavailabilities" to "service_role";
grant REFERENCES on public."unavailabilities" to "service_role";
grant TRIGGER on public."unavailabilities" to "service_role";
grant INSERT on public."audit_logs" to "anon";
grant SELECT on public."audit_logs" to "anon";
grant UPDATE on public."audit_logs" to "anon";
grant DELETE on public."audit_logs" to "anon";
grant TRUNCATE on public."audit_logs" to "anon";
grant REFERENCES on public."audit_logs" to "anon";
grant TRIGGER on public."audit_logs" to "anon";
grant INSERT on public."audit_logs" to "authenticated";
grant SELECT on public."audit_logs" to "authenticated";
grant UPDATE on public."audit_logs" to "authenticated";
grant DELETE on public."audit_logs" to "authenticated";
grant TRUNCATE on public."audit_logs" to "authenticated";
grant REFERENCES on public."audit_logs" to "authenticated";
grant TRIGGER on public."audit_logs" to "authenticated";
grant INSERT on public."audit_logs" to "service_role";
grant SELECT on public."audit_logs" to "service_role";
grant UPDATE on public."audit_logs" to "service_role";
grant DELETE on public."audit_logs" to "service_role";
grant TRUNCATE on public."audit_logs" to "service_role";
grant REFERENCES on public."audit_logs" to "service_role";
grant TRIGGER on public."audit_logs" to "service_role";
grant INSERT on public."championships" to "service_role";
grant SELECT on public."championships" to "service_role";
grant UPDATE on public."championships" to "service_role";
grant DELETE on public."championships" to "service_role";
grant TRUNCATE on public."championships" to "service_role";
grant REFERENCES on public."championships" to "service_role";
grant TRIGGER on public."championships" to "service_role";
grant INSERT on public."championships" to "authenticated";
grant SELECT on public."championships" to "authenticated";
grant UPDATE on public."championships" to "authenticated";
grant DELETE on public."championships" to "authenticated";
grant INSERT on public."teams" to "service_role";
grant SELECT on public."teams" to "service_role";
grant UPDATE on public."teams" to "service_role";
grant DELETE on public."teams" to "service_role";
grant TRUNCATE on public."teams" to "service_role";
grant REFERENCES on public."teams" to "service_role";
grant TRIGGER on public."teams" to "service_role";
grant INSERT on public."teams" to "authenticated";
grant SELECT on public."teams" to "authenticated";
grant UPDATE on public."teams" to "authenticated";
grant DELETE on public."teams" to "authenticated";
grant SELECT on public."match_events" to "anon";
grant TRUNCATE on public."match_events" to "anon";
grant REFERENCES on public."match_events" to "anon";
grant TRIGGER on public."match_events" to "anon";
grant INSERT on public."match_events" to "authenticated";
grant SELECT on public."match_events" to "authenticated";
grant UPDATE on public."match_events" to "authenticated";
grant DELETE on public."match_events" to "authenticated";
grant TRUNCATE on public."match_events" to "authenticated";
grant REFERENCES on public."match_events" to "authenticated";
grant TRIGGER on public."match_events" to "authenticated";
grant INSERT on public."match_events" to "service_role";
grant SELECT on public."match_events" to "service_role";
grant UPDATE on public."match_events" to "service_role";
grant DELETE on public."match_events" to "service_role";
grant TRUNCATE on public."match_events" to "service_role";
grant REFERENCES on public."match_events" to "service_role";
grant TRIGGER on public."match_events" to "service_role";
grant INSERT on public."championship_members" to "anon";
grant SELECT on public."championship_members" to "anon";
grant UPDATE on public."championship_members" to "anon";
grant DELETE on public."championship_members" to "anon";
grant TRUNCATE on public."championship_members" to "anon";
grant REFERENCES on public."championship_members" to "anon";
grant TRIGGER on public."championship_members" to "anon";
grant INSERT on public."championship_members" to "authenticated";
grant SELECT on public."championship_members" to "authenticated";
grant UPDATE on public."championship_members" to "authenticated";
grant DELETE on public."championship_members" to "authenticated";
grant TRUNCATE on public."championship_members" to "authenticated";
grant REFERENCES on public."championship_members" to "authenticated";
grant TRIGGER on public."championship_members" to "authenticated";
grant INSERT on public."championship_members" to "service_role";
grant SELECT on public."championship_members" to "service_role";
grant UPDATE on public."championship_members" to "service_role";
grant DELETE on public."championship_members" to "service_role";
grant TRUNCATE on public."championship_members" to "service_role";
grant REFERENCES on public."championship_members" to "service_role";
grant TRIGGER on public."championship_members" to "service_role";
grant INSERT on public."matches" to "service_role";
grant SELECT on public."matches" to "service_role";
grant UPDATE on public."matches" to "service_role";
grant DELETE on public."matches" to "service_role";
grant TRUNCATE on public."matches" to "service_role";
grant REFERENCES on public."matches" to "service_role";
grant TRIGGER on public."matches" to "service_role";
grant INSERT on public."matches" to "authenticated";
grant SELECT on public."matches" to "authenticated";
grant UPDATE on public."matches" to "authenticated";
grant DELETE on public."matches" to "authenticated";
grant INSERT on public."players" to "service_role";
grant SELECT on public."players" to "service_role";
grant UPDATE on public."players" to "service_role";
grant DELETE on public."players" to "service_role";
grant TRUNCATE on public."players" to "service_role";
grant REFERENCES on public."players" to "service_role";
grant TRIGGER on public."players" to "service_role";
grant INSERT on public."players" to "authenticated";
grant SELECT on public."players" to "authenticated";
grant UPDATE on public."players" to "authenticated";
grant DELETE on public."players" to "authenticated";
revoke all on function "private"."sync_profile_email"() from public,anon,authenticated;
revoke all on function "public"."guard_swap_target_update"() from public,anon,authenticated;
revoke all on function "private"."is_admin"() from public,anon,authenticated;
grant execute on function "private"."is_admin"() to authenticated;
revoke all on function "private"."protect_last_admin"() from public,anon,authenticated;
revoke all on function "private"."validate_shift_availability"() from public,anon,authenticated;
revoke all on function "public"."set_updated_at"() from public,anon,authenticated;
revoke all on function "public"."join_championship_by_code"(p_code text) from public,anon,authenticated;
grant execute on function "public"."join_championship_by_code"(p_code text) to authenticated;
revoke all on function "private"."handle_new_user"() from public,anon,authenticated;
revoke all on function "public"."capture_audit_log"() from public,anon,authenticated;
revoke all on function "public"."apply_approved_swap"() from public,anon,authenticated;
commit;

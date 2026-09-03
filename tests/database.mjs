import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,aud text,role text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
 grant usage on schema auth,public to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;`);
  await db.exec(await readFile("supabase/schema.sql", "utf8"));
  await db.exec(
    await readFile("supabase/upgrades/championship_integrity.sql", "utf8"),
  );
  await db.exec(
    await readFile("supabase/upgrades/championship_groups.sql", "utf8"),
  );
  await db.exec(
    await readFile("supabase/upgrades/match_locations.sql", "utf8"),
  );
  await db.exec(
    await readFile("supabase/upgrades/championship_audit.sql", "utf8"),
  );
  await db.exec(
    await readFile("supabase/upgrades/championship_management.sql", "utf8"),
  );
  // Exercise duplicate removal as well as repeatability on a clean snapshot.
  await db.exec(`create index if not exists idx_championship_members_championship_id on public.championship_members(championship_id);
    create index if not exists idx_championship_members_user_id on public.championship_members(user_id);`);
  const indexUpgrade = await readFile(
    "supabase/upgrades/database_indexes.sql",
    "utf8",
  );
  await db.exec(indexUpgrade);
  await db.exec(indexUpgrade);
  const indexes =
    await db.query(`select count(*)::int as count from pg_indexes where schemaname='public'
    and indexname in ('matches_home_team_idx','matches_away_team_idx','shifts_created_by_idx','shifts_service_type_idx',
      'swap_requests_reviewed_by_idx','swap_requests_shift_idx','swap_requests_target_soldier_idx','unavailabilities_created_by_idx')`);
  if (indexes.rows[0].count !== 8)
    throw new Error("Missing foreign-key indexes");
  const duplicates =
    await db.query(`select count(*)::int as count from pg_indexes where schemaname='public'
    and indexname in ('idx_championship_members_championship_id','idx_championship_members_user_id')`);
  if (duplicates.rows[0].count !== 0)
    throw new Error("Duplicate indexes remain");
  console.log(
    "PASS: eight foreign-key indexes, duplicate cleanup and repeatability",
  );
  const managementResult = await db.exec(
    await readFile("supabase/tests/championship_management.sql", "utf8"),
  );
  console.log(
    managementResult.flatMap((r) => r.rows).filter((r) => r.test_result),
  );
  const auditResult = await db.exec(
    await readFile("supabase/tests/championship_audit.sql", "utf8"),
  );
  console.log(auditResult.flatMap((r) => r.rows).filter((r) => r.test_result));
  const groupResult = await db.exec(
    await readFile("supabase/tests/championship_groups.sql", "utf8"),
  );
  console.log(groupResult.flatMap((r) => r.rows).filter((r) => r.test_result));
  const result = await db.exec(
    await readFile("supabase/tests/championship_integrity.sql", "utf8"),
  );
  console.log(result.flatMap((r) => r.rows).filter((r) => r.test_result));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}

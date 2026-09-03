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
  await db.exec(await readFile("supabase/upgrades/championship_management.sql", "utf8"));
  const managementResult=await db.exec(await readFile("supabase/tests/championship_management.sql", "utf8"));
  console.log(managementResult.flatMap(r=>r.rows).filter(r=>r.test_result));
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

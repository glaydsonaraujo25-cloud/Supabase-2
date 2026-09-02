-- Execute após schema.sql / upgrade. Todos os dados de teste são revertidos.
begin;
create function pg_temp.assert_ok(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'TEST FAILED: %',label; end if; end $$;
select set_config('test.owner',gen_random_uuid()::text,true),set_config('test.member',gen_random_uuid()::text,true),set_config('test.other',gen_random_uuid()::text,true),set_config('test.champ',gen_random_uuid()::text,true);
insert into auth.users(id,email,aud,role) select current_setting(k)::uuid,current_setting(k)||'@example.invalid','authenticated','authenticated' from unnest(array['test.owner','test.member','test.other']) k;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.championships(id,owner_id,name,format,status,max_teams,is_public) values(current_setting('test.champ')::uuid,current_setting('test.owner')::uuid,'Teste transacional','Mata-mata','aberto',4,true);
reset role;
insert into public.championship_members(championship_id,user_id) values(current_setting('test.champ')::uuid,current_setting('test.member')::uuid);
set local role authenticated;
select pg_temp.assert_ok((select count(*)=1 from public.championship_members where championship_id=current_setting('test.champ')::uuid),'owner sees members');
select pg_temp.assert_ok((select count(*)=1 from public.profiles where id=current_setting('test.member')::uuid),'owner sees member profile');
insert into public.teams(championship_id,name) select current_setting('test.champ')::uuid,'Time '||n from generate_series(1,4)n;
do $$ begin
 begin insert into public.teams(championship_id,name) values(current_setting('test.champ')::uuid,'Time extra');raise exception 'TEST FAILED: team limit'; exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end $$;
insert into public.matches(championship_id,home_team_id,away_team_id,round,bracket_stage,bracket_position) select current_setting('test.champ')::uuid,(array_agg(id order by name))[1],(array_agg(id order by name))[2],1,'Semifinal',1 from public.teams where championship_id=current_setting('test.champ')::uuid;
insert into public.matches(championship_id,home_team_id,away_team_id,round,bracket_stage,bracket_position) select current_setting('test.champ')::uuid,(array_agg(id order by name))[3],(array_agg(id order by name))[4],1,'Semifinal',2 from public.teams where championship_id=current_setting('test.champ')::uuid;
do $$ declare mid uuid; begin
 select id into mid from public.matches where championship_id=current_setting('test.champ')::uuid and bracket_position=1;
 begin perform public.save_knockout_result(mid,1,1,null,null);raise exception 'TEST FAILED: tied knockout';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
 perform public.save_knockout_result(mid,2,0,null,null);
end $$;
select public.save_knockout_result(id,1,0,null,null) from public.matches where championship_id=current_setting('test.champ')::uuid and bracket_stage='Semifinal' and bracket_position=2;
select pg_temp.assert_ok((select count(*)=1 from public.matches where championship_id=current_setting('test.champ')::uuid and bracket_stage='Final'),'one final generated');
do $$ declare mid uuid; begin
 select id into mid from public.matches where championship_id=current_setting('test.champ')::uuid and bracket_stage='Semifinal' and bracket_position=1;
 begin perform public.save_knockout_result(mid,0,4,null,null);raise exception 'TEST FAILED: changed previous winner';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
end $$;
select pg_temp.assert_ok((select home_score=2 from public.matches where championship_id=current_setting('test.champ')::uuid and bracket_stage='Semifinal' and bracket_position=1),'previous result unchanged');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.other'),'role','authenticated')::text,true);
select pg_temp.assert_ok((select count(*)=0 from public.matches where championship_id=current_setting('test.champ')::uuid),'outsider cannot read private member data');
do $$ begin
 begin perform public.reset_knockout(current_setting('test.champ')::uuid);raise exception 'TEST FAILED: outsider reset';exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise;end if;end;
end $$;
reset role;
set local role anon;
select pg_temp.assert_ok((select count(id)=1 from public.championships where id=current_setting('test.champ')::uuid),'anonymous public page');
do $$ begin
 begin perform invite_code from public.championships where id=current_setting('test.champ')::uuid;raise exception 'TEST FAILED: invite exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
set local role authenticated;
select public.reset_knockout(current_setting('test.champ')::uuid);
select pg_temp.assert_ok((select count(*)=0 from public.matches where championship_id=current_setting('test.champ')::uuid),'reset removes all bracket stages');
update public.teams set manager_user_id=current_setting('test.member')::uuid where championship_id=current_setting('test.champ')::uuid and name='Time 1';
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.member'),'role','authenticated')::text,true);
insert into public.players(team_id,name,shirt_number) select id,'Jogador teste',10 from public.teams where championship_id=current_setting('test.champ')::uuid and name='Time 1';
delete from public.championship_members where championship_id=current_setting('test.champ')::uuid;
reset role;
select pg_temp.assert_ok((select manager_user_id is null from public.teams where championship_id=current_setting('test.champ')::uuid and name='Time 1'),'leaving clears manager atomically');
select 'PASS: permissions, public access, limits, knockout progression, rollback and membership cleanup' as test_result;
rollback;

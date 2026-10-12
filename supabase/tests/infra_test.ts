import { PGlite } from 'npm:@electric-sql/pglite@0.5.8';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

Deno.test('infra reruns; RLS/grants isolate couples; jobs lease, fence, retry and cancel', async () => {
  const db = new PGlite();
  const a = '00000000-0000-0000-0000-000000000001'; const b = '00000000-0000-0000-0000-000000000002'; const c = '00000000-0000-0000-0000-000000000003';
  const couple = '10000000-0000-0000-0000-000000000001'; const other = '10000000-0000-0000-0000-000000000002';
  const first = '20000000-0000-0000-0000-000000000001'; const second = '20000000-0000-0000-0000-000000000002';
  const denied = async (sql: string) => {
    await db.exec('savepoint denied'); let failed = false;
    try { await db.exec(sql); } catch { failed = true; }
    await db.exec('rollback to savepoint denied; release savepoint denied'); assert(failed, `Expected denial: ${sql}`);
  };
  const scalar = async (sql: string) => (await db.query<{ value: number | boolean | string }>(sql)).rows[0]?.value;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon, service_role;
      create table public.couples(id uuid primary key);
      create table public.profiles(id uuid primary key, couple_id uuid references public.couples(id), display_name text);
      alter table public.profiles enable row level security;
      create policy profile_select on public.profiles for select to authenticated using (id = auth.uid());
      create policy profile_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
      grant select on public.profiles to authenticated;
      grant update (display_name) on public.profiles to authenticated;
      create function public.my_couple_id() returns uuid language sql security definer stable set search_path = '' as $$ select couple_id from public.profiles where id = auth.uid() $$;
      insert into public.couples values ('${couple}'),('${other}');
      insert into public.profiles values ('${a}','${couple}',null),('${b}','${couple}',null),('${c}','${other}',null);`);
    const sql = await Deno.readTextFile(new URL('../migrations/100_infra.sql', import.meta.url));
    await db.exec(sql); await db.exec(sql);
    await db.exec(`begin; set local role authenticated; set local request.jwt.claim.sub='${a}';`);
    await denied(`select * from public.claim_scheduled_jobs(10)`);
    await denied(`select public.finish_scheduled_job('${first}',1,null)`);
    await denied(`insert into public.scheduled_jobs(couple_id,kind,run_at) values ('${other}','countdown',now())`);
    await denied(`insert into public.scheduled_jobs(couple_id,kind,run_at,created_by) values ('${couple}','countdown',now(),'${b}')`);
    await denied(`insert into public.scheduled_jobs(couple_id,kind,run_at,attempts) values ('${couple}','countdown',now(),2)`);
    await db.exec(`insert into public.scheduled_jobs(id,couple_id,kind,run_at) values ('${first}','${couple}','countdown',now()),('${second}','${couple}','countdown',now());`);
    await db.exec(`update public.profiles set birthday = '2000-01-01', city = 'Mumbai', timezone = 'Asia/Kolkata', lat=19, lon=72 where id='${a}'`);
    await denied(`update public.profiles set couple_id='${other}' where id='${a}'`);
    await denied(`update public.scheduled_jobs set payload='{"forged":true}' where id='${first}'`);
    await denied(`update public.scheduled_jobs set status='done' where id='${first}'`);
    await db.exec(`set local request.jwt.claim.sub='${c}'`);
    assert(await scalar('select count(*)::int value from public.scheduled_jobs') === 0, 'Outsider must see no jobs');
    await db.exec(`set local request.jwt.claim.sub='${b}'; update public.scheduled_jobs set status='cancelled' where id='${second}'`);
    assert(await scalar(`select status value from public.scheduled_jobs where id='${second}'`) === 'cancelled', 'Partner can cancel couple jobs');
    await db.exec('set local role service_role');
    assert(await scalar('select count(*)::int value from public.claim_scheduled_jobs(10)') === 1, 'Claim only pending due job');
    assert(await scalar('select count(*)::int value from public.claim_scheduled_jobs(10)') === 0, 'Lease prevents duplicate claim');
    assert(await scalar(`select public.finish_scheduled_job('${first}',2,null) value`) === false, 'Stale completion fenced');
    assert(await scalar(`select public.finish_scheduled_job('${first}',1,'stub') value`) === true, 'Failure recorded');
    assert(await scalar('select count(*)::int value from public.claim_scheduled_jobs(10)') === 0, 'Retry delay respected');
    await db.exec(`update public.scheduled_jobs set run_at=now()-interval '1 minute' where id='${first}'`);
    await db.exec('select * from public.claim_scheduled_jobs(10)');
    assert(await scalar(`select attempts value from public.scheduled_jobs where id='${first}'`) === 2, 'Retry increments attempts');
    assert(await scalar(`select public.finish_scheduled_job('${first}',1,null) value`) === false, 'Old worker cannot finish new claim');
    await db.exec(`update public.scheduled_jobs set locked_until=now()-interval '1 second' where id='${first}'`);
    await db.exec('select * from public.claim_scheduled_jobs(10)');
    assert(await scalar(`select attempts value from public.scheduled_jobs where id='${first}'`) === 3, 'Expired lease reclaimed');
    await db.exec(`set local role authenticated; set local request.jwt.claim.sub='${a}'; update public.scheduled_jobs set status='cancelled' where id='${first}'; set local role service_role;`);
    assert(await scalar(`select status value from public.scheduled_jobs where id='${first}'`) === 'pending', 'Claimed job cannot be cancelled');
    await db.exec(`select public.finish_scheduled_job('${first}',3,'stub')`);
    assert(await scalar(`select status value from public.scheduled_jobs where id='${first}'`) === 'failed', 'Final failure terminal');
    await db.exec(`update public.scheduled_jobs set status='pending', attempts=0, locked_until=null,run_at=now() where id='${first}'; select * from public.claim_scheduled_jobs(10); select public.finish_scheduled_job('${first}',1,null);`);
    assert(await scalar(`select status value from public.scheduled_jobs where id='${first}'`) === 'done', 'Successful work done');
    await db.exec('rollback');
  } finally { await db.close(); }
});

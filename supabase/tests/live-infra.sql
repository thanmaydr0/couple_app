-- Run in SQL Editor. Uses the existing member only inside a rolled-back
-- transaction; does not change profiles, send notifications or leave jobs.
begin;
do $$
declare actor uuid; couple uuid; job uuid := gen_random_uuid(); visible int;
begin
  select id,couple_id into actor,couple from public.profiles where couple_id is not null limit 1;
  if actor is null then raise exception 'No paired profile available for RLS test'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  insert into public.scheduled_jobs(id,couple_id,kind,run_at) values(job,couple,'countdown',now()+interval '100 years');
  begin
    update public.scheduled_jobs set payload='{"forged":true}' where id=job;
    raise exception 'Payload update unexpectedly permitted';
  exception when insufficient_privilege then null; end;
  begin
    update public.scheduled_jobs set status='done' where id=job;
    raise exception 'Client completion unexpectedly permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_scheduled_jobs(1);
    raise exception 'Claim RPC unexpectedly permitted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.scheduled_jobs(couple_id,kind,run_at) values(gen_random_uuid(),'countdown',now());
    raise exception 'Cross-couple insert unexpectedly permitted';
  exception when insufficient_privilege then null; end;
  update public.scheduled_jobs set status='cancelled' where id=job;
  if not exists(select 1 from public.scheduled_jobs where id=job and status='cancelled') then raise exception 'Cancellation did not work'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  select count(*) into visible from public.scheduled_jobs where id=job;
  if visible <> 0 then raise exception 'Outsider can see job'; end if;
  execute 'reset role';
end $$;
rollback;

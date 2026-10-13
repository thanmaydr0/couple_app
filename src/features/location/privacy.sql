-- Hosted SQL Editor regression. No push is sent, and all changes roll back.
begin;
do $$
declare actor uuid; partner uuid; couple uuid; journey uuid := gen_random_uuid(); place uuid := gen_random_uuid(); changed int;
begin
  select p.id, p.couple_id into actor, couple from public.profiles p where p.couple_id is not null limit 1;
  select id into partner from public.profiles where couple_id = couple and id <> actor limit 1;
  if actor is null or partner is null then raise exception 'Two paired test accounts are required'; end if;
  if exists(select 1 from public.locations) then raise exception 'Do not run this fixture while real sharing is active'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  execute 'set local role authenticated';
  insert into public.locations(user_id,couple_id,lat,lon,sharing_until) values(actor,couple,0,0,now()+interval '1 hour');
  insert into public.journeys(id,user_id,couple_id,dest_name,dest_lat,dest_lon) values(journey,actor,couple,'Privacy fixture',0,0);
  insert into public.saved_places(id,user_id,couple_id,name,lat,lon) values(place,actor,couple,'Privacy fixture',0,0);
  for changed in 1..20 loop
    insert into public.saved_places(user_id,couple_id,name,lat,lon,notify_partner) values(actor,couple,'Alert fixture',0,0,true);
  end loop;
  begin
    insert into public.saved_places(user_id,couple_id,name,lat,lon,notify_partner) values(actor,couple,'Over budget fixture',0,0,true);
    raise exception 'The 21st enabled place unexpectedly succeeded';
  exception when check_violation then null; end;
  begin
    insert into public.locations(user_id,couple_id,lat,lon,sharing_until) values(partner,couple,0,0,now()+interval '1 hour');
    raise exception 'Writing a partner row unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.locations set user_id=partner where user_id=actor;
    raise exception 'Reassigning ownership unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',partner::text,true);
  if not exists(select 1 from public.locations where user_id=actor) then raise exception 'Live partner read failed'; end if;
  if not exists(select 1 from public.journeys where id=journey) then raise exception 'Live journey read failed'; end if;
  if exists(select 1 from public.saved_places where id=place) then raise exception 'Partner can read private saved coordinates'; end if;
  update public.locations set lat=1 where user_id=actor;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Partner updated actor point'; end if;
  delete from public.locations where user_id=actor;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Partner deleted actor point'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if exists(select 1 from public.locations) then raise exception 'Outsider can read a location'; end if;
  execute 'reset role';
  update public.locations set sharing_until=now()-interval '1 second' where user_id=actor;
  perform set_config('request.jwt.claim.sub',partner::text,true);
  execute 'set local role authenticated';
  if exists(select 1 from public.locations where user_id=actor) then raise exception 'Partner can read after expiry'; end if;
  if exists(select 1 from public.journeys where id=journey) then raise exception 'Partner can read expired journey'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  delete from public.locations where user_id=actor;
  if exists(select 1 from public.locations where user_id=actor) then raise exception 'Stop retained a point'; end if;
  if exists(select 1 from public.journeys where id=journey) then raise exception 'Stop retained a journey'; end if;
  execute 'reset role';
  if not exists(select 1 from cron.job where jobname='location-expiry-cleanup' and active) then raise exception 'Expiry cleanup is missing'; end if;
  if has_table_privilege('authenticated','public.locations','TRUNCATE') then raise exception 'Authenticated role can bypass RLS using TRUNCATE'; end if;
end $$;
rollback;
select 'PASS: ownership, partner live read, expiry denial, private places, Stop deletion, cleanup registered; fixture rolled back' as privacy_result;

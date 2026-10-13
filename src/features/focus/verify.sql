-- Integration test. Every fixture, including auth rows, is rolled back.
begin;
do $$
declare cid uuid:=gen_random_uuid(); other_cid uuid:=gen_random_uuid();
 u uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 s public.focus_sessions; next_room public.focus_sessions; total int;
begin
 insert into auth.users(id) values(u),(partner),(outsider);
 insert into public.couples(id) values(cid),(other_cid);
 insert into public.profiles(id,couple_id) values(u,cid),(partner,cid),(outsider,other_cid) on conflict(id) do update set couple_id=excluded.couple_id;
 perform set_config('request.jwt.claim.sub',u::text,true);
 s:=public.focus_start(60,60,3,'Integration test');
 if s.started_by<>u or s.status<>'active' then raise exception 'Start failed'; end if;
 begin
  perform public.focus_start(60,60,1,'Duplicate');
  raise exception 'Concurrent room guard failed';
 exception when raise_exception then
  if sqlerrm not like 'Your partner already%' then raise; end if;
 end;
 update public.focus_sessions set started_at=clock_timestamp()-interval '125 seconds' where id=s.id;
 perform public.focus_sync(s.id); perform public.focus_sync(s.id);
 select count(*) into total from public.garden_plants where session_id=s.id;
 if total<>1 then raise exception 'Expected one deduplicated work reward, got %',total; end if;
 perform set_config('request.jwt.claim.sub',partner::text,true);
 perform public.focus_join(s.id); perform public.focus_sync(s.id);
 select sum(completed_cycles) into total from public.focus_log where session_id=s.id;
 if total<>2 then raise exception 'Join credit failed'; end if;
 update public.focus_sessions set started_at=clock_timestamp()-interval '181 seconds' where id=s.id;
 s:=public.focus_sync(s.id,true);
 if s.status<>'cancelled' then raise exception 'Early end failed'; end if;
 select count(*) into total from public.garden_plants where session_id=s.id;
 if total<>2 then raise exception 'Completed cycle catch-up failed'; end if;
 update public.focus_sessions set started_at=clock_timestamp()-interval '1 day' where id=s.id;
 perform public.focus_sync(s.id);
 select count(*) into total from public.garden_plants where session_id=s.id;
 if total<>2 then raise exception 'Cancelled session kept rewarding'; end if;
 next_room:=public.focus_start(60,60,1,'Finish test');
 update public.focus_sessions set started_at=clock_timestamp()-interval '61 seconds' where id=next_room.id;
 next_room:=public.focus_sync(next_room.id);
 if next_room.status<>'finished' then raise exception 'Final work should finish without break'; end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin
  perform public.focus_sync(s.id);
  raise exception 'Cross couple RPC allowed';
 exception when raise_exception then
  if sqlerrm<>'Room unavailable' then raise; end if;
 end;
 execute 'set local role authenticated';
 select count(*) into total from public.focus_sessions where couple_id=cid;
 if total<>0 then raise exception 'RLS leaked rooms'; end if;
 select count(*) into total from public.garden_plants where couple_id=cid;
 if total<>0 then raise exception 'RLS leaked plants'; end if;
 select count(*) into total from public.focus_log where couple_id=cid;
 if total<>0 then raise exception 'RLS leaked logs'; end if;
 if has_table_privilege('authenticated','public.garden_plants','INSERT') then raise exception 'Rewards are forgeable'; end if;
 if has_function_privilege('anon','public.focus_start(integer,integer,integer,text)','EXECUTE') then raise exception 'Anonymous start allowed'; end if;
 execute 'reset role';
end $$;
rollback;
select 'PASS: starts, join credit, catch-up, idempotent rewards, early end, natural finish, cross-couple RPC/RLS and write permissions; fixtures rolled back' as focus_verification;

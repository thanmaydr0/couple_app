-- Integration checks run against real RLS inside a transaction; no fixtures survive.
begin;
select set_config('plans.test_couple',(select couple_id::text from public.profiles where couple_id is not null group by couple_id having count(*)=2 limit 1),true);
select set_config('plans.test_a',(select id::text from public.profiles where couple_id=current_setting('plans.test_couple')::uuid order by id limit 1),true);
select set_config('plans.test_b',(select id::text from public.profiles where couple_id=current_setting('plans.test_couple')::uuid order by id desc limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('plans.test_a'),true);
set local role authenticated;
do $$ declare eid uuid:=gen_random_uuid(); begin
 perform set_config('plans.test_event',eid::text,true);
 insert into public.events(id,couple_id,title,starts_at,ends_at,status,proposed_by,created_by) values(eid,public.my_couple_id(),'Plans verification',now()+interval '2 days',now()+interval '2 days 1 hour','proposed',auth.uid(),auth.uid());
 begin perform public.plans_respond(eid,'confirmed'); raise exception 'Self acceptance permitted'; exception when others then if sqlerrm='Self acceptance permitted' then raise; end if; end;
 perform public.plans_save_availability('[{"weekday":6,"start_minute":600,"end_minute":660,"tz":"Asia/Kolkata"}]');
 if (select count(*) from public.availability where user_id=auth.uid())<>1 then raise exception 'Availability save failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('plans.test_b'),true);
set local role authenticated;
select public.plans_respond(current_setting('plans.test_event')::uuid,'confirmed');
do $$ declare eid uuid:=current_setting('plans.test_event')::uuid; begin
 if (select status from public.events where id=eid)<>'confirmed' then raise exception 'Acceptance failed'; end if;
 if not exists(select 1 from public.countdowns where id=eid) then raise exception 'Countdown not created'; end if;
 if (select count(*) from public.scheduled_jobs where kind='plan_reminder' and payload->>'event_id'=eid::text and status='pending')<>2 then raise exception 'Both phone fallbacks not queued'; end if;
 perform public.plans_pin_countdown(eid,true);
 if not exists(select 1 from public.countdowns where id=eid and pinned) then raise exception 'Pin failed'; end if;
 begin update public.availability set start_minute=500 where user_id=current_setting('plans.test_a')::uuid; if found then raise exception 'Partner availability editable'; end if; end;
 update public.events set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day' where id=eid;
 if (select count(*) from public.scheduled_jobs where kind='plan_reminder' and payload->>'event_id'=eid::text and status='pending')<>2 then raise exception 'Reschedule failed'; end if;
 delete from public.events where id=eid;
 if exists(select 1 from public.countdowns where id=eid) or exists(select 1 from public.scheduled_jobs where payload->>'event_id'=eid::text and status='pending') then raise exception 'Delete cancellation failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.events) or exists(select 1 from public.countdowns) or exists(select 1 from public.availability) then raise exception 'Unpaired user can read Plans'; end if;
end $$;
reset role;
select 'Plans RLS, accept, pin, reschedule, cancellation passed; rolling back' as result;
rollback;

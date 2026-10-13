-- Run against a fresh ledger. All fixtures roll back.
begin;
do $$
declare u uuid; v uuid; c uuid; eid uuid:=gen_random_uuid(); gid uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); jid uuid; result jsonb; n int;
begin
 select couple_id into c from public.profiles where couple_id is not null group by couple_id having count(*)=2 limit 1;
 if c is null then raise exception 'Test requires an existing paired account'; end if;
 select id into u from public.profiles where couple_id=c order by id limit 1;
 select id into v from public.profiles where couple_id=c and id<>u;
 if exists(select 1 from public.wallet_expenses where couple_id=c) or exists(select 1 from public.wallet_settlements where couple_id=c) then raise exception 'Run on a fresh wallet before real data is entered'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 insert into public.wallet_expenses(id,couple_id,paid_by,amount_minor,category) values(eid,c,u,451,'food');
 insert into public.wallet_goals(id,couple_id,title,target_minor,created_by) values(gid,c,'Wallet rollback test',1000,u);
 insert into public.wallet_contributions(goal_id,couple_id,user_id,amount_minor) values(gid,c,u,250);
 if (select saved_minor from public.wallet_goals where id=gid)<>250 then raise exception 'Contribution total mismatch'; end if;
 begin update public.wallet_goals set saved_minor=9999 where id=gid; raise exception 'Saved amount spoof allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.wallet_expenses(couple_id,paid_by,amount_minor,category) values(gen_random_uuid(),u,100,'food'); raise exception 'Cross-couple write allowed'; exception when insufficient_privilege then null; end;
 perform public.wallet_settle('INR',225,'Rollback test');
 if (select amount_minor from public.wallet_settlements where couple_id=c)<>225 then raise exception 'Odd paise settlement incorrect'; end if;
 begin perform public.wallet_settle('INR',225); raise exception 'Duplicate settlement allowed'; exception when raise_exception then if sqlerrm='Duplicate settlement allowed' then raise; end if; end;
 begin
  insert into public.wallet_expenses(couple_id,paid_by,amount_minor,category,split_type,split) values(c,u,100,'food','percent','{"payer_bps":null}');
  raise exception 'JSON null percentage accepted';
 exception when check_violation then null; end;
 insert into public.wallet_expenses(couple_id,paid_by,amount_minor,category,split_type,split) values
  (c,u,10001,'food','percent','{"payer_bps":2500}'),
  (c,u,1000,'food','custom','{"payer_minor":100}'),
  (c,u,750,'food','paid_for_partner','{}'),
  (c,u,800,'food','paid_for_me','{}'),
  (c,v,999,'food','equal','{}');
 perform public.wallet_settle('INR',8652,'All split types, both payers');
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if (select count(*) from public.wallet_expenses)<>0 then raise exception 'Outsider read allowed'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into public.wallet_recurring(id,couple_id,template,next_run) values(rid,c,jsonb_build_object('paid_by',u,'amount_minor',1500000,'currency','INR','category','rent','note','Rollback rent','split_type','equal','split','{}'::jsonb,'spent_on','2026-01-31','receipt_path',null),current_date-1);
 select id into jid from public.scheduled_jobs where couple_id=c and payload->>'recurring_id'=rid::text;
 if jid is null then raise exception 'Recurring job missing'; end if;
 execute 'reset role';
 result:=public.wallet_run_recurring(jid);
 if (result->>'amount_minor')::bigint<>1500000 then raise exception 'Recurring amount incorrect'; end if;
 perform public.wallet_run_recurring(jid);
 select count(*) into n from public.wallet_expenses where recurring_id=rid;
 if n<>1 then raise exception 'Duplicate recurring expense'; end if;
 if (select count(*) from public.scheduled_jobs where payload->>'recurring_id'=rid::text)<>2 then raise exception 'Duplicate next recurring job'; end if;
 execute 'set local role authenticated';
 delete from public.wallet_recurring where id=rid;
 if exists(select 1 from public.scheduled_jobs where payload->>'recurring_id'=rid::text and status='pending') then raise exception 'Stop did not cancel jobs'; end if;
 execute 'reset role';
end $$;
rollback;
select 'PASS: RLS, foreign-couple rejection, saved-total protection, odd paise settlement, duplicate settlement rejection, recurring enqueue/materialization/retry/cancellation. All fixtures rolled back.' as wallet_checks;

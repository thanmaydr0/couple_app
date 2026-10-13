-- Integration tests use throwaway fixtures and ALWAYS roll back. Run as postgres.
begin;
create temporary table chat_test_fixture as select gen_random_uuid() cid,gen_random_uuid() other_cid,
 gen_random_uuid() author,gen_random_uuid() recipient,gen_random_uuid() outsider,
 gen_random_uuid() fresh,gen_random_uuid() old_message,gen_random_uuid() once_photo,
 gen_random_uuid() schedule,gen_random_uuid() claimed;
grant select on chat_test_fixture to authenticated;
insert into public.couples(id) select cid from chat_test_fixture union all select other_cid from chat_test_fixture;
insert into auth.users(id) select author from chat_test_fixture union all select recipient from chat_test_fixture union all select outsider from chat_test_fixture;
insert into public.profiles(id,couple_id) select author,cid from chat_test_fixture union all select recipient,cid from chat_test_fixture union all select outsider,other_cid from chat_test_fixture on conflict(id) do update set couple_id=excluded.couple_id;
insert into public.messages(id,couple_id,sender_id,kind,body,client_id,created_at)
 select fresh,cid,author,'text','hello',fresh::text,now() from chat_test_fixture union all
 select old_message,cid,author,'text','old',old_message::text,now()-interval '16 minutes' from chat_test_fixture;
insert into public.messages(id,couple_id,sender_id,kind,media_path,client_id,view_once)
 select once_photo,cid,author,'image',cid||'/chat-once/'||author||'/test.jpg',once_photo::text,true from chat_test_fixture;
insert into public.messages(couple_id,sender_id,kind,body,client_id) select cid,author,'text','expired fixture',gen_random_uuid()::text from chat_test_fixture;
update public.messages set expires_at=now()-interval '1 second' where body='expired fixture' and couple_id=(select cid from chat_test_fixture);
insert into public.scheduled_jobs(id,couple_id,kind,run_at,payload,created_by)
 select schedule,cid,'scheduled_message',now()+interval '1 day',jsonb_build_object('body','later'),author from chat_test_fixture;
insert into public.scheduled_jobs(id,couple_id,kind,run_at,payload,created_by,locked_until,attempts)
 select claimed,cid,'scheduled_message',now()-interval '1 minute',jsonb_build_object('body','morning','phrases',jsonb_build_array('hello','hi'),'recurrence',jsonb_build_object('hour',8,'minute',0,'timezone','Asia/Kolkata')),author,now()+interval '5 minutes',1 from chat_test_fixture;
select set_config('request.jwt.claim.sub',author::text,true) from chat_test_fixture;
set local role authenticated;
do $$ declare f record; rejected boolean:=false; begin
 select * into f from chat_test_fixture;
 if exists(select 1 from public.messages where couple_id=f.cid and body='expired fixture') then raise exception 'Expired row leaked'; end if;
 update public.messages set body='edited',edited_at=now() where id=f.fresh;
 if not exists(select 1 from public.messages where id=f.fresh and body='edited' and edited_at is not null) then raise exception 'Edit failed'; end if;
 begin update public.messages set body='too late' where id=f.old_message; exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Old edit accepted'; end if;
 rejected:=false;
 begin update public.messages set read_at=now() where id=f.fresh; exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Author read receipt accepted'; end if;
 rejected:=false;
 begin insert into public.messages(couple_id,sender_id,kind,body,client_id) values(f.cid,f.author,'system','forged',gen_random_uuid()::text); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Forged system message accepted'; end if;
 insert into public.message_reactions(message_id,couple_id,user_id,emoji) values(f.fresh,f.cid,f.author,'❤️');
 insert into public.message_reactions(message_id,couple_id,user_id,emoji) values(f.fresh,f.cid,f.author,'😂') on conflict(message_id,user_id) do update set emoji=excluded.emoji;
 if (select count(*) from public.message_reactions where message_id=f.fresh)<>1 then raise exception 'Reaction not unique'; end if;
 perform public.chat_set_timer(86400);
 if not exists(select 1 from public.messages where couple_id=f.cid and kind='system' and body='Disappearing messages: 24 hours' and expires_at is null) then raise exception 'Timer system message failed'; end if;
 insert into public.messages(couple_id,sender_id,kind,body,client_id) values(f.cid,f.author,'text','expires',gen_random_uuid()::text);
 if not exists(select 1 from public.messages where couple_id=f.cid and body='expires' and expires_at between now()+interval '23 hours' and now()+interval '25 hours') then raise exception 'Expiry not stamped'; end if;
 perform public.chat_edit_schedule(f.schedule,'changed',now()+interval '2 days');
 rejected:=false;
 begin perform public.chat_edit_schedule(f.claimed,'late change',now()+interval '2 days'); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Claimed job editable'; end if;
 perform public.chat_edit_schedule(f.schedule,'',now(),true);
 if not exists(select 1 from public.scheduled_jobs where id=f.schedule and status='cancelled' and payload='{}') then raise exception 'Cancellation not scrubbed'; end if;
 update public.messages set deleted_at=now() where id=f.old_message;
 if not exists(select 1 from public.messages where id=f.old_message and body is null and deleted_at is not null) then raise exception 'Tombstone not scrubbed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',recipient::text,true) from chat_test_fixture;
set local role authenticated;
do $$ declare f record; rejected boolean:=false; begin
 select * into f from chat_test_fixture;
 if exists(select 1 from public.scheduled_jobs where id in(f.schedule,f.claimed)) then raise exception 'Partner can read unsent bodies'; end if;
 update public.scheduled_jobs set status='cancelled' where id=f.claimed;
 update public.messages set read_at=now() where id=f.fresh;
 update public.messages set pinned_at=now(),pinned_by=f.recipient where id=f.fresh;
 if not exists(select 1 from public.messages where id=f.fresh and read_at is not null and pinned_by=f.recipient) then raise exception 'Receipt/pin failed'; end if;
 begin update public.messages set body='stolen' where id=f.fresh; exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Partner edited author body'; end if;
 rejected:=false;
 begin insert into public.message_reactions(message_id,couple_id,user_id,emoji) values(f.fresh,f.cid,f.author,'👍'); exception when insufficient_privilege then rejected:=true; end;
 if not rejected then raise exception 'Partner spoofed reaction'; end if;
 rejected:=false;
 begin perform public.chat_edit_schedule(f.schedule,'steal',now()+interval '2 days'); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Partner edited author schedule'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',outsider::text,true) from chat_test_fixture;
set local role authenticated;
do $$ declare f record; begin
 select * into f from chat_test_fixture;
 if exists(select 1 from public.messages where couple_id=f.cid) or exists(select 1 from public.message_reactions where couple_id=f.cid) or exists(select 1 from public.chat_settings where couple_id=f.cid) then raise exception 'Cross-couple leak'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
do $$ declare f record; first_path text; second_path text; first_id uuid; second_id uuid; begin
 select * into f from chat_test_fixture;
 first_path:=public.chat_claim_once(f.once_photo,f.recipient,f.cid);
 second_path:=public.chat_claim_once(f.once_photo,f.recipient,f.cid);
 if first_path is null or second_path is not null then raise exception 'One-time claim is not atomic'; end if;
 if public.chat_claim_once(f.once_photo,f.outsider,f.cid) is not null then raise exception 'Outsider claimed photo'; end if;
 first_id:=public.chat_dispatch_schedule(f.claimed,1);
 second_id:=public.chat_dispatch_schedule(f.claimed,1);
 if first_id is null or first_id is distinct from second_id or (select count(*) from public.messages where client_id='scheduled:'||f.claimed::text)<>1 then raise exception 'Duplicate scheduled delivery'; end if;
 if (select count(*) from public.scheduled_jobs where couple_id=f.cid and kind='scheduled_message' and id not in(f.schedule,f.claimed))<>1 then raise exception 'Duplicate recurring continuation'; end if;
 -- A quoted message can be purged without deleting the reply/couple_id.
 insert into public.messages(couple_id,sender_id,kind,body,client_id,reply_to) values(f.cid,f.recipient,'text','quote',gen_random_uuid()::text,f.fresh);
 delete from public.messages where id=f.fresh;
 if not exists(select 1 from public.messages where couple_id=f.cid and body='quote' and reply_to is null) then raise exception 'Reply FK prevents purge'; end if;
 if not exists(select 1 from public.scheduled_jobs where couple_id=f.cid and kind='disappearing_purge') then raise exception 'Cleanup jobs not queued'; end if;
end $$;
select 'chatplus database assertions passed; all fixtures rolled back' as result;
rollback;

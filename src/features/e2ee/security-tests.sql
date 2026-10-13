-- Synthetic fixtures only. Entire test rolls back; no user content is read.
begin;
create temp table e2ee_test_ids as select gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() outsider,gen_random_uuid() cid,gen_random_uuid() other_cid,gen_random_uuid() mid;
insert into auth.users(id) select a from e2ee_test_ids union all select b from e2ee_test_ids union all select outsider from e2ee_test_ids;
insert into public.couples(id) select cid from e2ee_test_ids union all select other_cid from e2ee_test_ids;
update public.profiles set couple_id=(select cid from e2ee_test_ids) where id in(select a from e2ee_test_ids union all select b from e2ee_test_ids);
update public.profiles set couple_id=(select other_cid from e2ee_test_ids) where id=(select outsider from e2ee_test_ids);
grant select on e2ee_test_ids to authenticated;
select set_config('request.jwt.claim.sub',(select a::text from e2ee_test_ids),true);
set local role authenticated;
do $$ begin
 begin perform public.e2ee_set_enabled(true); raise exception 'TEST FAILED: enabled without keys'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 perform public.e2ee_register(repeat('A',43)||'=',jsonb_build_object('nonce',repeat('A',32),'ciphertext',repeat('A',64)),repeat('B',43)||'=', '{"N":32768,"r":8,"p":1,"dkLen":32}');
end $$;
select set_config('request.jwt.claim.sub',(select b::text from e2ee_test_ids),true);
select public.e2ee_register(repeat('C',43)||'=',jsonb_build_object('nonce',repeat('A',32),'ciphertext',repeat('A',64)),repeat('D',43)||'=', '{"N":32768,"r":8,"p":1,"dkLen":32}');
do $$ begin
 if (select count(*) from public.user_keys)<>2 then raise exception 'TEST FAILED: partner key access'; end if;
 if (select count(*) from public.key_backups)<>1 then raise exception 'TEST FAILED: backup privacy'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select a::text from e2ee_test_ids),true);
-- Prove authors can still send plaintext before the opt-in ceremony.
insert into public.messages(id,couple_id,sender_id,kind,body,client_id)
select mid,cid,a,'text','legacy fixture',mid::text from e2ee_test_ids;
select public.e2ee_set_enabled(true);
do $$ declare i record; wire jsonb; rid uuid; job uuid:=gen_random_uuid(); begin
 select * into i from e2ee_test_ids;
 wire:=jsonb_build_object('v',1,'nonce',repeat('A',32),'ciphertext',repeat('A',64),'senderKey',repeat('A',43)||'=','recipientKey',repeat('C',43)||'=');
 begin insert into public.messages(couple_id,sender_id,kind,body,client_id) values(i.cid,i.a,'text','must fail',gen_random_uuid()::text); raise exception 'TEST FAILED: plaintext accepted'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 begin update public.couples set e2ee_enabled=false where id=i.cid; raise exception 'TEST FAILED: direct flag update accepted'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 perform public.e2ee_reencrypt(i.mid,wire,null);
 if not exists(select 1 from public.messages where id=i.mid and body is null and meta is null and enc=wire) then raise exception 'TEST FAILED: history conversion'; end if;
 insert into public.messages(couple_id,sender_id,kind,body,enc,client_id) values(i.cid,i.a,'text',null,wire,gen_random_uuid()::text) returning id into rid;
 update public.messages set enc=jsonb_set(wire,'{ciphertext}',to_jsonb(repeat('B',64))),edited_at=now() where id=rid;
 insert into public.messages(couple_id,sender_id,kind,meta,enc,media_path,client_id) values(i.cid,i.a,'voice',null,wire,i.cid::text||'/chat/voice/'||gen_random_uuid()::text||'.m4a',gen_random_uuid()::text);
 insert into public.message_reactions(couple_id,message_id,user_id,emoji,enc) values(i.cid,rid,i.a,'🔒',wire);
 begin update public.message_reactions set enc=null,emoji='❤️' where message_id=rid; raise exception 'TEST FAILED: plaintext reaction'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 perform public.e2ee_save_schedule(job,now()+interval '1 hour',wire,null,false);
 if exists(select 1 from public.scheduled_jobs where id=job and payload ? 'body') then raise exception 'TEST FAILED: schedule leaked body'; end if;
 begin insert into public.scheduled_jobs(couple_id,created_by,kind,run_at,payload) values(i.cid,i.a,'scheduled_message',now()+interval '1 hour','{"body":"leak"}'); raise exception 'TEST FAILED: plaintext schedule'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 update public.messages set deleted_at=now() where id=rid;
 if exists(select 1 from public.messages where id=rid and (enc is not null or body is not null)) then raise exception 'TEST FAILED: tombstone retained content'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select b::text from e2ee_test_ids),true);
do $$ declare i record; begin
 select * into i from e2ee_test_ids;
 begin update public.messages set enc=jsonb_set(enc,'{ciphertext}',to_jsonb(repeat('C',64))) where id=i.mid; raise exception 'TEST FAILED: partner edit'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 update public.messages set read_at=now() where id=i.mid;
 if not exists(select 1 from public.messages where id=i.mid and read_at is not null) then raise exception 'TEST FAILED: encrypted receipts'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select outsider::text from e2ee_test_ids),true);
do $$ begin
 if exists(select 1 from public.user_keys) or exists(select 1 from public.key_backups) or exists(select 1 from public.messages) then raise exception 'TEST FAILED: cross-couple disclosure'; end if;
end $$;
reset role;
select 'E2EE SQL isolation, recovery ownership, rollout, text, edits, voice, reactions, schedules, history and tombstones passed' as result;
rollback;

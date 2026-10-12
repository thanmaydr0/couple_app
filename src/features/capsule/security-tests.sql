-- Run the entire file as postgres in SQL Editor. Everything rolls back.
-- Uses the existing two-member couple without changing their accounts/data.
begin;
create temporary table capsule_test_context as
 select gen_random_uuid() as capsule_id, p.couple_id,
 (array_agg(p.id order by p.id))[1] as author_id,
 (array_agg(p.id order by p.id))[2] as partner_id
 from public.profiles p where p.couple_id is not null group by p.couple_id having count(*)=2 limit 1;
grant select on capsule_test_context to authenticated;
do $$ begin if not exists(select 1 from capsule_test_context) then raise exception 'A two-member couple is required'; end if; end $$;
select set_config('request.jwt.claim.sub',author_id::text,true) from capsule_test_context;
set local role authenticated;
insert into public.capsules(id,couple_id,author_id,title,body,unlock_at,open_together)
 select capsule_id,couple_id,author_id,'SECRET TITLE','SECRET BODY',now()+interval '1 day',true from capsule_test_context;
do $$ begin
 if (select count(*) from public.capsules where id=(select capsule_id from capsule_test_context)) <> 1 then raise exception 'Author read failed'; end if;
end $$;
select set_config('request.jwt.claim.sub',partner_id::text,true) from capsule_test_context;
do $$ declare hint text; n integer; ok boolean; begin
 if exists(select 1 from public.capsules where id=(select capsule_id from capsule_test_context)) then raise exception 'SEALED ROW LEAK'; end if;
 select count(*),max(title_hint) into n,hint from public.capsule_stubs() where id=(select capsule_id from capsule_test_context);
 if n<>1 or hint is not null then raise exception 'STUB TITLE LEAK'; end if;
 select public.capsule_unlocked(couple_id::text||'/capsules/'||capsule_id::text||'/test.jpg') into ok from capsule_test_context;
 if ok then raise exception 'SEALED MEDIA LEAK'; end if;
 begin
   perform public.capsule_hold((select capsule_id from capsule_test_context),true);
   raise exception 'EARLY HOLD ACCEPTED';
 exception when raise_exception then if sqlerrm='EARLY HOLD ACCEPTED' then raise; end if; end;
end $$;
-- Simulate elapsed time with the privileged test session, never the client clock.
reset role;
update public.capsules set unlock_at=now()-interval '1 hour' where id=(select capsule_id from capsule_test_context);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.capsules where id=(select capsule_id from capsule_test_context)) then raise exception 'TOGETHER ROW LEAK'; end if;
end $$;
-- Only the server ceremony RPC can set these fields for an app user.
reset role;
do $$ begin
 if has_column_privilege('authenticated','public.capsules','ceremony_started_at','UPDATE') then raise exception 'CEREMONY GRANT LEAK'; end if;
 if has_column_privilege('authenticated','public.capsules','author_id','UPDATE') then raise exception 'IDENTITY GRANT LEAK'; end if;
 if has_function_privilege('anon','public.capsule_stubs()','EXECUTE') then raise exception 'ANON STUB ACCESS'; end if;
end $$;
update public.capsules set ceremony_started_at=now(),opened_at=now() where id=(select capsule_id from capsule_test_context);
set local role authenticated;
do $$ begin
 if (select body from public.capsules where id=(select capsule_id from capsule_test_context)) <> 'SECRET BODY' then raise exception 'Unlocked partner read failed'; end if;
end $$;
select set_config('request.jwt.claim.sub',author_id::text,true) from capsule_test_context;
do $$ declare affected integer; begin
 update public.capsules set body='TAMPERED' where id=(select capsule_id from capsule_test_context);
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'EDIT AFTER UNLOCK'; end if;
 delete from public.capsules where id=(select capsule_id from capsule_test_context);
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'DELETE AFTER UNLOCK'; end if;
end $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$ begin
 if exists(select 1 from public.capsules where id=(select capsule_id from capsule_test_context)) then raise exception 'OUTSIDER ROW LEAK'; end if;
 if exists(select 1 from public.capsule_stubs()) then raise exception 'OUTSIDER STUB LEAK'; end if;
end $$;
select 'PASS: author read, partner seal, stub, media helper, early hold, ceremony grants, unlocked read, outsider denial, immutable after unlock' as result;
rollback;

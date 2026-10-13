-- Live transactional authorization/validation regression. All fixture rows and
-- cleanup jobs are rolled back; no notifications or real content are sent.
begin;
do $$
declare cid uuid; author uuid; receiver uuid;
begin
 select couple_id,min(id::text)::uuid,max(id::text)::uuid into cid,author,receiver
 from public.profiles where couple_id is not null group by couple_id having count(*)=2 limit 1;
 if cid is null then raise exception 'A paired test context is required'; end if;
 perform set_config('test.voice.couple',cid::text,true);
 perform set_config('test.voice.author',author::text,true);
 perform set_config('test.voice.receiver',receiver::text,true);
 perform set_config('test.voice.message',gen_random_uuid()::text,true);
end $$;
set local role authenticated;
do $$
declare cid uuid:=current_setting('test.voice.couple')::uuid;
 author uuid:=current_setting('test.voice.author')::uuid;
 receiver uuid:=current_setting('test.voice.receiver')::uuid;
 mid uuid:=current_setting('test.voice.message')::uuid;
 metadata jsonb:=jsonb_build_object('duration_ms',1000,'peaks',(select jsonb_agg(0.5) from generate_series(1,64)));
 result jsonb; first_heard jsonb;
begin
 perform set_config('request.jwt.claim.sub',author::text,true);
 insert into public.messages(id,client_id,couple_id,sender_id,kind,media_path,meta)
 values(mid,mid::text,cid,author,'voice',cid::text||'/chat/voice/'||mid::text||'.m4a',metadata);
 begin
  perform public.voice_mark_played(mid);
  raise exception 'TEST FAILURE: author marked voice heard';
 exception when raise_exception then if sqlerrm like 'TEST FAILURE:%' then raise; end if; end;
 begin
  insert into public.messages(client_id,couple_id,sender_id,kind,media_path,meta)
  values(gen_random_uuid()::text,cid,author,'voice','outside/chat/voice/file.m4a',metadata);
  raise exception 'TEST FAILURE: wrong-couple path accepted';
 exception when raise_exception then if sqlerrm like 'TEST FAILURE:%' then raise; end if; end;
 begin
  insert into public.messages(client_id,couple_id,sender_id,kind,media_path,meta)
  values(gen_random_uuid()::text,cid,author,'voice',cid::text||'/chat/voice/'||gen_random_uuid()::text||'.m4a',jsonb_set(metadata,'{duration_ms}','300001'));
  raise exception 'TEST FAILURE: excessive duration accepted';
 exception when raise_exception then if sqlerrm like 'TEST FAILURE:%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',receiver::text,true);
 result:=public.voice_mark_played(mid); first_heard:=result->'played_at';
 if first_heard is null or result-'played_at'<>metadata then raise exception 'TEST FAILURE: receipt or immutable waveform'; end if;
 if public.voice_mark_played(mid)->'played_at'<>first_heard then raise exception 'TEST FAILURE: receipt changed'; end if;
 begin
  update public.messages set meta=jsonb_set(meta,'{duration_ms}','2000') where id=mid;
  raise exception 'TEST FAILURE: receiver changed duration';
 exception when raise_exception then if sqlerrm like 'TEST FAILURE:%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if exists(select 1 from public.messages where id=mid) then raise exception 'TEST FAILURE: cross-couple message visible'; end if;
 begin
  perform public.voice_mark_played(mid);
  raise exception 'TEST FAILURE: outsider marked heard';
 exception when raise_exception then if sqlerrm like 'TEST FAILURE:%' then raise; end if; end;
end $$;
rollback;

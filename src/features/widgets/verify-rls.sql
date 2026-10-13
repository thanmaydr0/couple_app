-- Live rollback-only authorization/RPC regression. No persistent rows or pushes.
begin;
do $$ declare actor uuid; pair uuid; begin
  select id,couple_id into actor,pair from public.profiles where couple_id is not null order by id limit 1;
  if actor is null then raise exception 'Requires a paired profile'; end if;
  perform set_config('widgets.test_actor',actor::text,true);
  perform set_config('widgets.test_pair',pair::text,true);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated')::text,true);
  -- Remove only this transaction's cooldown interference; rollback restores it.
  delete from public.pulse_heartbeats where user_id=actor and created_at > now()-interval '10 seconds';
end $$;
set local role authenticated;
do $$ declare actor uuid := current_setting('widgets.test_actor')::uuid; pair uuid := current_setting('widgets.test_pair')::uuid; item uuid := gen_random_uuid(); begin
  insert into public.doodles(id,couple_id,author_id,image_path) values(item,pair,actor,pair::text || '/' || actor::text || '/' || item::text || '.png');
  if not exists(select 1 from public.doodles where id=item) then raise exception 'Own doodle not readable'; end if;
  perform set_config('widgets.test_doodle',item::text,true);
  begin
    insert into public.doodles(couple_id,author_id,image_path) values(pair,'00000000-0000-0000-0000-000000000001',pair::text || '/00000000-0000-0000-0000-000000000001/spoof.png');
    raise exception 'Spoofed author was accepted';
  exception when insufficient_privilege then null; end;
  if public.widget_heartbeat() is not true then raise exception 'First heartbeat rejected'; end if;
  if public.widget_heartbeat() is not false then raise exception 'Cooldown did not reject second heartbeat'; end if;
  begin
    perform public.claim_widget_push(item);
    raise exception 'Client claimed a privileged push';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare partner uuid; begin
  select id into partner from public.profiles where couple_id=current_setting('widgets.test_pair')::uuid and id<>current_setting('widgets.test_actor')::uuid limit 1;
  if partner is null then raise exception 'Requires a partner'; end if;
  perform set_config('request.jwt.claim.sub',partner::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',partner,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.doodles where id=current_setting('widgets.test_doodle')::uuid) then raise exception 'Partner cannot read doodle'; end if;
  if has_table_privilege('authenticated','public.widget_push_claims','select') then raise exception 'Push claims exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.doodles) then raise exception 'Outsider can read doodles'; end if;
  begin
    perform public.widget_heartbeat();
    raise exception 'Unpaired heartbeat accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: owner insert/read, partner read, outsider isolation, author spoof rejection, heartbeat cooldown, privileged claim isolation; rolled back' as result;
rollback;

-- Transactional backend acceptance check. Leaves no accounts, rows or messages.
-- Run as postgres after the base schema and Scribble private policies.
begin;
do $$
declare member_id uuid := gen_random_uuid(); partner_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid(); own_couple uuid := gen_random_uuid();
  other_couple uuid := gen_random_uuid(); match_id uuid := gen_random_uuid();
begin
  insert into public.couples(id) values (own_couple), (other_couple);
  insert into auth.users(id, email) values
    (member_id, member_id::text || '@scribble-test.invalid'),
    (partner_id, partner_id::text || '@scribble-test.invalid'),
    (outsider_id, outsider_id::text || '@scribble-test.invalid');
  update public.profiles set couple_id = own_couple where id in (member_id, partner_id);
  update public.profiles set couple_id = other_couple where id = outsider_id;
  insert into public.scribble_matches(id, couple_id, created_by) values (match_id, own_couple, member_id);
  perform set_config('scribble_test.member', member_id::text, true);
  perform set_config('scribble_test.partner', partner_id::text, true);
  perform set_config('scribble_test.outsider', outsider_id::text, true);
  perform set_config('scribble_test.match', match_id::text, true);
end $$;
set local role authenticated;
do $$
declare target uuid := current_setting('scribble_test.match')::uuid; affected int;
begin
  perform set_config('request.jwt.claim.sub', current_setting('scribble_test.member'), true);
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('scribble_test.member'), 'role', 'authenticated')::text, true);
  if (select count(*) from public.scribble_matches where id = target) <> 1 then raise exception 'Member SELECT denied'; end if;
  update public.scribble_matches set rounds_played = 1, scores = '{"test":100}' where id = target;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Member UPDATE denied'; end if;
  perform set_config('realtime.topic', 'scribble:' || target::text, true);
  insert into realtime.messages(topic, extension, event, private, payload) values ('scribble:' || target::text, 'broadcast', 'scribble_test', true, '{}');
  if not exists(select 1 from realtime.messages where event = 'scribble_test' and topic = 'scribble:' || target::text) then raise exception 'Member broadcast SELECT denied'; end if;

  perform set_config('request.jwt.claim.sub', current_setting('scribble_test.partner'), true);
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('scribble_test.partner'), 'role', 'authenticated')::text, true);
  if (select count(*) from public.scribble_matches where id = target and rounds_played = 1) <> 1 then raise exception 'Partner SELECT denied'; end if;
  if not exists(select 1 from realtime.messages where event = 'scribble_test' and topic = 'scribble:' || target::text) then raise exception 'Partner broadcast SELECT denied'; end if;

  perform set_config('request.jwt.claim.sub', current_setting('scribble_test.outsider'), true);
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('scribble_test.outsider'), 'role', 'authenticated')::text, true);
  if exists(select 1 from public.scribble_matches where id = target) then raise exception 'Outsider SELECT leaked'; end if;
  update public.scribble_matches set rounds_played = 9 where id = target;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Outsider UPDATE allowed'; end if;
  if exists(select 1 from realtime.messages where event = 'scribble_test' and topic = 'scribble:' || target::text) then raise exception 'Outsider broadcast SELECT leaked'; end if;
  begin
    insert into realtime.messages(topic, extension, event, private, payload) values ('scribble:' || target::text, 'broadcast', 'scribble_test_outsider', true, '{}');
    raise exception 'Outsider broadcast INSERT allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

-- Execute on the deployed database. All fixtures and gameplay roll back.
begin;
do $$ declare cid uuid:=gen_random_uuid(); other_cid uuid:=gen_random_uuid(); u1 uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); u3 uuid:=gen_random_uuid(); u4 uuid:=gen_random_uuid(); begin
 insert into public.couples(id) values(cid),(other_cid);
 insert into auth.users(id,email) values(u1,u1::text||'@gamenight.test'),(u2,u2::text||'@gamenight.test'),(u3,u3::text||'@gamenight.test'),(u4,u4::text||'@gamenight.test');
 insert into public.profiles(id,couple_id) values(u1,cid),(u2,cid),(u3,other_cid),(u4,other_cid) on conflict(id) do update set couple_id=excluded.couple_id;
 perform set_config('gamenight.test_u1',u1::text,true); perform set_config('gamenight.test_u2',u2::text,true); perform set_config('gamenight.test_u3',u3::text,true); perform set_config('gamenight.test_cid',cid::text,true);
end $$;
set local role authenticated;
do $$ declare u1 uuid:=current_setting('gamenight.test_u1')::uuid; u2 uuid:=current_setting('gamenight.test_u2')::uuid; u3 uuid:=current_setting('gamenight.test_u3')::uuid;
 cid uuid:=current_setting('gamenight.test_cid')::uuid; r public.game_rounds; old_id uuid; i integer; j integer; turn_id uuid; sequence integer[]; scenario integer;
 prompt jsonb:='{"id":"test-know","game":"know","category":"favorites","text":"Favorite fruit?","options":[]}';
 rp jsonb:='{"id":"test-rather","game":"rather","category":"together","text":"Choose","options":["Tea","Coffee"]}';
 tp jsonb:='{"id":"test-truth","game":"roulette","category":"sweet","kind":"truth","text":"A favorite memory?","options":[]}';
begin
 perform set_config('request.jwt.claim.sub',u1::text,true);
 r:=public.gamenight_action('start',null,jsonb_build_object('game','know','prompt',prompt)); old_id:=r.id;
 if r.status<>'lobby' then raise exception 'No lobby'; end if;
 if (public.gamenight_action('start',null,jsonb_build_object('game','know','prompt',prompt))).id<>old_id then raise exception 'Duplicate live game'; end if;
 begin perform public.gamenight_action('answer',r.id,'{"step":0,"answer":"Strawberry"}'); raise exception 'Expected lobby rejection'; exception when others then if sqlerrm<>'Your partner must join first' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',u2::text,true); r:=public.gamenight_action('join',r.id);
 for i in 0..9 loop
  perform set_config('request.jwt.claim.sub',u1::text,true);
  r:=public.gamenight_action('answer',r.id,jsonb_build_object('step',i,'answer','Strawberry'));
  if (r.state->>'reveal')::boolean then raise exception 'Early reveal'; end if;
  if (select count(*) from public.gamenight_choices where round_id=r.id and step=i)<>1 then raise exception 'Author cannot read own answer'; end if;
  begin perform public.gamenight_action('answer',r.id,jsonb_build_object('step',i,'answer','Apple')); raise exception 'Expected duplicate rejection'; exception when unique_violation then null; end;
  perform set_config('request.jwt.claim.sub',u2::text,true);
  if (select count(*) from public.gamenight_choices where round_id=r.id and step=i)<>0 then raise exception 'Partner secret leaked before reveal'; end if;
  r:=public.gamenight_action('answer',r.id,jsonb_build_object('step',i,'answer',case when i<8 then 'Strawbery' else 'Banana' end));
  if not (r.state->>'reveal')::boolean or (r.state->>'matched')::boolean is distinct from (i<8) then raise exception 'Bad typed scoring'; end if;
  if (select count(*) from public.gamenight_choices where round_id=r.id and step=i)<>2 then raise exception 'Both answers not visible'; end if;
  begin perform public.gamenight_action('next',r.id,jsonb_build_object('step',i-1,'prompt',prompt)); raise exception 'Expected stale rejection'; exception when others then if sqlerrm<>'Game changed. Refresh and try again' then raise; end if; end;
  r:=public.gamenight_action('next',r.id,jsonb_build_object('step',i,'prompt',prompt));
  if i<9 and (r.state->>'turn')::uuid<>(case when i%2=0 then u2 else u1 end) then raise exception 'Roles did not swap'; end if;
 end loop;
 if r.status<>'finished' or (select played from public.game_stats where couple_id=cid and game='know')<>1 then raise exception 'Know stats missing'; end if;
 if (select (extra->>'matches')::integer from public.game_stats where couple_id=cid and game='know')<>8 then raise exception 'Knowing percentage wrong'; end if;
 if (r.state->'scores'->>u1::text)::integer<>4 or (r.state->'scores'->>u2::text)::integer<>4 then raise exception 'Guess scores wrong'; end if;
 begin perform public.gamenight_action('next',r.id,'{"step":9}'); raise exception 'Expected finished rejection'; exception when others then if sqlerrm<>'This game has finished' then raise; end if; end;
 -- Couples cannot read or act on each other's games, including via definer RPC.
 perform set_config('request.jwt.claim.sub',u3::text,true);
 if exists(select 1 from public.game_rounds where id=old_id) or exists(select 1 from public.game_stats where couple_id=cid) or exists(select 1 from public.gamenight_choices where round_id=old_id) then raise exception 'Cross-couple RLS failed'; end if;
 begin perform public.gamenight_action('join',old_id); raise exception 'Expected cross-couple rejection'; exception when others then if sqlerrm<>'Game not found' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',u1::text,true);
 -- Direct table writes (including undo and score forgery) have no grant.
 begin update public.game_rounds set state='{}' where id=old_id; raise exception 'Expected direct write rejection'; exception when insufficient_privilege then null; end;
 begin update public.game_stats set wins_a=100 where couple_id=cid; raise exception 'Expected stat write rejection'; exception when insufficient_privilege then null; end;
 begin update public.gamenight_choices set answer='spoof' where round_id=old_id; raise exception 'Expected secret edit rejection'; exception when insufficient_privilege then null; end;
 -- Would you rather: ten simultaneous reveals and persistent agreement statistics.
 r:=public.gamenight_action('start',null,jsonb_build_object('game','rather','prompt',rp));
 perform set_config('request.jwt.claim.sub',u2::text,true); r:=public.gamenight_action('join',r.id);
 for i in 0..9 loop
  perform set_config('request.jwt.claim.sub',u1::text,true); r:=public.gamenight_action('answer',r.id,jsonb_build_object('step',i,'answer','Tea'));
  perform set_config('request.jwt.claim.sub',u2::text,true);
  if exists(select 1 from public.gamenight_choices where round_id=r.id and step=i) then raise exception 'Rather secret leaked'; end if;
  r:=public.gamenight_action('answer',r.id,jsonb_build_object('step',i,'answer',case when i<7 then 'Tea' else 'Coffee' end));
  r:=public.gamenight_action('next',r.id,jsonb_build_object('step',i,'prompt',rp));
 end loop;
 if r.status<>'finished' or (select (extra->>'matches')::integer from public.game_stats where couple_id=cid and game='rather')<>7 then raise exception 'Agreement stats wrong'; end if;
 -- Roulette: two skip tokens each, forbidden extra skip, completion, voluntary end.
 perform set_config('request.jwt.claim.sub',u1::text,true); r:=public.gamenight_action('start',null,jsonb_build_object('game','roulette','prompt',tp));
 perform set_config('request.jwt.claim.sub',u2::text,true); r:=public.gamenight_action('join',r.id);
 for i in 0..4 loop
  turn_id:=(r.state->>'turn')::uuid; perform set_config('request.jwt.claim.sub',turn_id::text,true);
  r:=public.gamenight_action('spin',r.id,jsonb_build_object('step',i,'pool',jsonb_build_array(tp)));
  if i<4 then r:=public.gamenight_action('skip',r.id,jsonb_build_object('step',i));
  else
   begin perform public.gamenight_action('skip',r.id,jsonb_build_object('step',i)); raise exception 'Expected exhausted token rejection'; exception when others then if sqlerrm<>'No skip tokens left. You can always end this game' then raise; end if; end;
   r:=public.gamenight_action('complete',r.id,jsonb_build_object('step',i));
  end if;
  if i<4 then r:=public.gamenight_action('next',r.id,jsonb_build_object('step',i,'prompt',tp)); end if;
 end loop;
 if jsonb_array_length(r.state->'completed')<>5 or (r.state->'scores'->>u1::text)::integer<>1 then raise exception 'Checkoffs wrong'; end if;
 r:=public.gamenight_action('end',r.id,'{"step":4}');
 if r.status<>'finished' then raise exception 'Voluntary end failed'; end if;
 -- Connect Four: gravity, turn order, stale/undo rejection, win and rematch.
 perform set_config('request.jwt.claim.sub',u1::text,true); r:=public.gamenight_action('start',null,'{"game":"connect"}');
 perform set_config('request.jwt.claim.sub',u2::text,true); r:=public.gamenight_action('join',r.id);
 begin perform public.gamenight_action('move',r.id,'{"step":0,"column":0}'); raise exception 'Expected turn rejection'; exception when others then if sqlerrm<>'Wait for your turn' then raise; end if; end;
 for i in 0..6 loop
  turn_id:=(r.state->>'turn')::uuid; perform set_config('request.jwt.claim.sub',turn_id::text,true);
  r:=public.gamenight_action('move',r.id,jsonb_build_object('step',i,'column',case when i%2=0 then 0 else 1 end));
  if i=0 and (r.state->>'last')::integer<>35 then raise exception 'Gravity failed'; end if;
 end loop;
 if r.status<>'finished' or (r.state->>'winner')::uuid<>u1 or jsonb_array_length(r.state->'line')<>4 then raise exception 'Connect win failed'; end if;
 old_id:=r.id; r:=public.gamenight_action('start',null,'{"game":"connect"}');
 if r.id=old_id or r.state->'board'<>'[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]'::jsonb then raise exception 'Rematch failed'; end if;
 perform set_config('request.jwt.claim.sub',(case when r.created_by=u1 then u2 else u1 end)::text,true); r:=public.gamenight_action('join',r.id);
 for i in 0..5 loop perform set_config('request.jwt.claim.sub',r.state->>'turn',true); r:=public.gamenight_action('move',r.id,jsonb_build_object('step',i,'column',0)); end loop;
 perform set_config('request.jwt.claim.sub',r.state->>'turn',true);
 begin perform public.gamenight_action('move',r.id,'{"step":6,"column":0}'); raise exception 'Expected full column rejection'; exception when others then if sqlerrm<>'This column is full' then raise; end if; end;
 begin perform public.gamenight_action('undo',r.id,'{"step":6}'); raise exception 'Expected undo rejection'; exception when others then if sqlerrm<>'Action unavailable' then raise; end if; end;
 -- Fresh isolated couple for each additional board outcome, all rolled back.
 for scenario in 0..3 loop
  reset role;
  insert into public.couples default values returning id into cid;
  update public.profiles set couple_id=cid where id in (u1,u2);
  set local role authenticated;
  sequence:=case scenario when 0 then array[0,6,1,6,2,5,3]
   when 1 then array[0,1,1,2,4,2,2,3,4,3,5,3,3]
   when 2 then array[6,5,5,4,2,4,4,3,2,3,1,3,3]
   else array[2,4,4,0,3,3,6,1,0,0,1,4,4,2,3,5,0,4,2,3,3,1,4,2,1,3,5,5,2,0,5,5,5,1,0,2,1,6,6,6,6,6] end;
  perform set_config('request.jwt.claim.sub',u1::text,true); r:=public.gamenight_action('start',null,'{"game":"connect"}');
  perform set_config('request.jwt.claim.sub',u2::text,true); r:=public.gamenight_action('join',r.id);
  for j in 1..array_length(sequence,1) loop
   perform set_config('request.jwt.claim.sub',r.state->>'turn',true);
   r:=public.gamenight_action('move',r.id,jsonb_build_object('step',j-1,'column',sequence[j]));
  end loop;
  if r.status<>'finished' then raise exception 'Board outcome did not finish: %',scenario; end if;
  if scenario<3 and ((r.state->>'winner')::uuid<>u1 or jsonb_array_length(r.state->'line')<>4) then raise exception 'Win axis failed: %',scenario; end if;
  if scenario=3 and (r.state->>'winner' is not null or jsonb_array_length(r.state->'line')<>0 or (r.state->>'step')::integer<>42) then raise exception 'Draw failed'; end if;
 end loop;
 -- Malformed RPC prompts must not poison decodable shared state.
 perform set_config('request.jwt.claim.sub',u1::text,true);
 begin perform public.gamenight_action('start',null,'{"game":"know","prompt":{"game":"know","options":[]}}'); raise exception 'Expected invalid prompt rejection'; exception when others then if sqlerrm<>'Invalid prompt' then raise; end if; end;
 -- Custom prompt sharing, ownership and cross-couple isolation.
 perform set_config('request.jwt.claim.sub',u1::text,true);
 insert into public.gamenight_prompts(couple_id,game,category,text,created_by) values(cid,'know','favorites','Our custom question?',u1);
 begin insert into public.gamenight_prompts(couple_id,game,category,text,options,created_by) values(cid,'rather','together','Invalid choices','[1,2]',u1); raise exception 'Expected option type rejection'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',u2::text,true);
 if not exists(select 1 from public.gamenight_prompts where couple_id=cid) then raise exception 'Custom prompt not shared'; end if;
 delete from public.gamenight_prompts where couple_id=cid;
 if not exists(select 1 from public.gamenight_prompts where couple_id=cid) then raise exception 'Partner deleted author prompt'; end if;
 perform set_config('request.jwt.claim.sub',u3::text,true);
 if exists(select 1 from public.gamenight_prompts where couple_id=cid) then raise exception 'Custom prompt cross-couple leak'; end if;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.game_rounds','SELECT') or has_function_privilege('anon','public.gamenight_action(text,uuid,jsonb)','EXECUTE') then raise exception 'Anonymous access exposed'; end if;
end $$;
select 'PASS: secret RLS, cross-couple isolation, immutable answers, typed scoring, role swaps, agreement stats, skips/checkoffs, all four Connect Four win axes, draw/rematch/full columns, undo rejection, custom ownership, invalid prompt rejection' as result;
rollback;

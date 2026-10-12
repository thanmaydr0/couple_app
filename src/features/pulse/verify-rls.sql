-- Acceptance tests run under authenticated RLS; all fixtures roll back.
begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); couple uuid := gen_random_uuid(); other uuid := gen_random_uuid();
begin
 insert into public.couples(id,timezone) values(couple,'Pacific/Kiritimati'),(other,'America/Adak');
 insert into auth.users(id,email) values(a,a::text||'@pulse-test.invalid'),(b,b::text||'@pulse-test.invalid'),(c,c::text||'@pulse-test.invalid');
 update public.profiles set couple_id=couple where id in (a,b);
 update public.profiles set couple_id=other where id=c;
 perform set_config('pulse_test.a',a::text,true); perform set_config('pulse_test.b',b::text,true); perform set_config('pulse_test.c',c::text,true); perform set_config('pulse_test.couple',couple::text,true);
 insert into public.pulse_answers(couple_id,user_id,day,answer) values(couple,b,(now() at time zone 'Pacific/Kiritimati')::date-1,'Past secret');
end $$;
set local role authenticated;
do $$
declare couple uuid := current_setting('pulse_test.couple')::uuid; a uuid := current_setting('pulse_test.a')::uuid; b uuid := current_setting('pulse_test.b')::uuid; d date;
begin
 perform set_config('request.jwt.claim.sub',b::text,true);
 d := pulse_private.today();
 if d <> (now() at time zone 'Pacific/Kiritimati')::date then raise exception 'Timezone mismatch'; end if;
 insert into public.pulse_answers(couple_id,user_id,day,answer) values(couple,b,d,'B secret');
 if (select count(*) from public.pulse_answers where day=d)<>1 then raise exception 'Own answer hidden'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 if exists(select 1 from public.pulse_answers where day=d) then raise exception 'Blind answer leaked'; end if;
 if (select count(*) from public.pulse_answers where day=d-1)<>1 then raise exception 'Past answer hidden'; end if;
 begin
 insert into public.pulse_answers(couple_id,user_id,day,answer) values(couple,b,d,'Spoof');
 raise exception 'Spoof permitted';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.pulse_answers(couple_id,user_id,day,answer) values(couple,a,d+1,'Future');
 raise exception 'Future permitted';
 exception when insufficient_privilege then null; end;
 insert into public.pulse_answers(couple_id,user_id,day,answer) values(couple,a,d,'A secret');
 if (select count(*) from public.pulse_answers where day=d)<>2 then raise exception 'Reveal failed'; end if;
 begin
 delete from public.pulse_answers where user_id=a;
 raise exception 'Withdrawal permitted';
 exception when insufficient_privilege then null; end;
 insert into public.pulse_status(user_id,couple_id,mood,availability) values(a,couple,'joyful','free');
 update public.pulse_status set availability='studying' where user_id=a;
 insert into public.pulse_heartbeats(couple_id,user_id,day) values(couple,a,d);
 perform set_config('realtime.topic','pulse:'||couple::text,true);
 insert into realtime.messages(topic,extension,event,private,payload) values('pulse:'||couple::text,'broadcast','pulse_test',true,'{}');
 perform set_config('request.jwt.claim.sub',b::text,true);
 if (select count(*) from public.pulse_status where user_id=a and availability='studying')<>1 then raise exception 'Status not shared'; end if;
 update public.pulse_status set mood='sad' where user_id=a;
 if found then raise exception 'Partner overwrote status'; end if;
 if (select count(*) from public.pulse_heartbeats where day=d)<>1 then raise exception 'Counter not shared'; end if;
 perform set_config('request.jwt.claim.sub',current_setting('pulse_test.c'),true);
 if exists(select 1 from public.pulse_answers where couple_id=couple) then raise exception 'Outsider answers leaked'; end if;
 if exists(select 1 from public.pulse_status where couple_id=couple) then raise exception 'Outsider status leaked'; end if;
 if exists(select 1 from public.pulse_heartbeats where couple_id=couple) then raise exception 'Outsider counter leaked'; end if;
 begin
 insert into realtime.messages(topic,extension,event,private,payload) values('pulse:'||couple::text,'broadcast','pulse_test_denied',true,'{}');
 raise exception 'Outsider topic accepted';
 exception when insufficient_privilege then null; end;
end $$;
rollback;

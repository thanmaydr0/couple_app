begin;
-- This test reads existing rows only. No fixtures or source mutations.
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where couple_id is not null limit 1),true);
set local role authenticated;
do $$
declare expected text[]; actual text[] := '{}'; item record; cursor_at timestamptz; cursor_id text := ''; stats jsonb; n bigint; attempts int := 0; test_day date;
begin
 stats := public.story_summary(2026,'Asia/Kolkata');
 select count(*) into n from public.messages t where couple_id=public.my_couple_id() and kind<>'system'
  and created_at >= '2026-01-01 00:00 Asia/Kolkata'::timestamptz and created_at < least(now(),'2027-01-01 00:00 Asia/Kolkata'::timestamptz)
  and coalesce(to_jsonb(t)->>'deleted_at','')='' and (nullif(to_jsonb(t)->>'expires_at','') is null or (to_jsonb(t)->>'expires_at')::timestamptz>now());
 if (stats #>> '{messages,total}')::bigint<>n then raise exception 'Aggregate crossed RLS boundary or count mismatch'; end if;
 if stats ? 'wallet_expenses' or stats ? 'wallet_goals' then raise exception 'Money leaked into Wrapped'; end if;
 if to_regclass('public.game_rounds') is null and stats ? 'game_rounds' then raise exception 'Missing source was not skipped'; end if;
 select array_agg(e.id order by e.at desc,e.id desc) into expected from public.story_feed(null,'',100) e;
 loop
  select * into item from public.story_feed(cursor_at,cursor_id,1) limit 1;
  exit when not found;
  actual := array_append(actual,item.id); cursor_at:=item.at; cursor_id:=item.id; attempts:=attempts+1;
  exit when attempts>=100;
 end loop;
 if expected is distinct from nullif(actual,'{}'::text[]) then raise exception 'Pagination lost or duplicated entries'; end if;
 select (min(e.at) at time zone 'Asia/Kolkata')::date + interval '1 year' into test_day from public.story_entries() e where e.kind in ('media','list','event','message');
 if exists(select 1 from public.story_feed(null,'',100,'all',test_day,'Asia/Kolkata') e where to_char(e.at at time zone 'Asia/Kolkata','MM-DD')<>to_char(test_day,'MM-DD') or extract(year from e.at at time zone 'Asia/Kolkata')>=extract(year from test_day)) then raise exception 'On-this-day date mismatch'; end if;
 perform public.story_summary(null,'Asia/Kolkata');
 perform public.story_memory_days('America/New_York');
 if has_function_privilege('anon','public.story_summary(integer,text)','execute') then raise exception 'Anonymous definer execution allowed'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
 begin
  perform public.story_summary(2026,'UTC');
  raise exception 'Unpaired user was not rejected';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.story_feed();
  raise exception 'Unpaired feed user was not rejected';
 exception when insufficient_privilege then null;
 end;
end $$;
select 'PASS: RLS/count parity; stable pagination; on-this-day dates; optional tables; all-time summary; timezone grouping; money exclusion; anon and unpaired denial' as story_database_checks;
rollback;

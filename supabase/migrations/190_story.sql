-- Read-only projections. No source tables, policies, or publications are changed.
begin;
create or replace function public.story_entries(p_before timestamptz default null, p_before_id text default '', p_limit int default null, p_kind text default 'all', p_day date default null, p_timezone text default 'UTC')
returns table(id text, kind text, at timestamptz, title text, detail text, path text)
language plpgsql stable security invoker set search_path = '' as $$
declare s record; c uuid := public.my_couple_id();
begin
 if auth.uid() is null or c is null then raise exception 'Couple membership required' using errcode='42501'; end if;
 for s in select * from (values
  ('media','media','taken_at','coalesce(j->>''caption'', ''A memory together'')','j->>''kind''','coalesce(j->>''thumb_path'',j->>''storage_path'')','true'),
  ('list_items','list','done_at','j->>''title''','j->>''notes''','j->>''photo_path''','done_at is not null'),
  ('capsules','capsule','opened_at','j->>''title''','''A time capsule opened together''','null::text','opened_at is not null'),
  ('events','event','starts_at','j->>''title''','j->>''kind''','null::text','status = ''confirmed'''),
  ('chess_games','game','updated_at','''A chess victory''','j->>''winner_id''','null::text','winner_id is not null'),
  ('game_rounds','game','updated_at','''Game night: '' || (j->>''game'')','''A game together''','null::text','status = ''finished'''),
  ('scribble_matches','game','updated_at','''Scribble night''','''Drawn together''','null::text','scores #>> ''{_scribble,phase}'' = ''final'''),
  ('watch_sessions','game','created_at','coalesce(j->>''title'',''Movie night'')','''Watched together''','null::text','status = ''ended'''),
  ('messages','message','created_at','''A little hello''','j->>''body''','null::text','kind = ''text'' and coalesce(j->>''deleted_at'','''')='''' and (nullif(j->>''expires_at'','''') is null or (j->>''expires_at'')::timestamptz>now())')
 ) as v(tbl,k,dt,ttl,descr,img,predicate) loop
  if to_regclass('public.' || s.tbl) is null then continue; end if;
  if p_day is not null and s.k not in ('media','list','event','message') then continue; end if;
  if p_day is null and (s.k='message' or (p_kind <> 'all' and s.k <> p_kind)) and p_limit is not null then continue; end if;
  return query execute format('select %L || t.id::text, %L, t.%I, %s, %s, %s from public.%I t cross join lateral (select to_jsonb(t) j) x where t.couple_id = $1 and (%s) and t.%I <= now() and ($2 is null or (t.%I,%L || t.id::text) < ($2,$3)) and ($4 is null or (extract(year from t.%I at time zone $5) < extract(year from $4) and to_char(t.%I at time zone $5,''MM-DD'')=to_char($4,''MM-DD''))) order by t.%I desc,t.id desc limit $6',s.tbl||':',s.k,s.dt,s.ttl,s.descr,s.img,s.tbl,s.predicate,s.dt,s.dt,s.tbl||':',s.dt,s.dt,s.dt) using c,p_before,p_before_id,p_day,p_timezone,p_limit;
 end loop;
end $$;

create or replace function public.story_feed(p_before timestamptz default null, p_before_id text default '', p_limit int default 40, p_kind text default 'all', p_day date default null, p_timezone text default 'UTC')
returns table(id text, kind text, at timestamptz, title text, detail text, path text)
language sql stable security invoker set search_path = '' as $$
 select * from public.story_entries(p_before,p_before_id,greatest(1,least(p_limit,100)),p_kind,p_day,p_timezone) e
 where (p_before is null or (e.at,e.id) < (p_before,p_before_id))
 and (case when p_day is not null then e.kind in ('media','list','event','message')
       else e.kind <> 'message' and (p_kind='all' or e.kind=p_kind) end)
 and (p_day is null or (extract(year from e.at at time zone p_timezone) < extract(year from p_day)
   and to_char(e.at at time zone p_timezone,'MM-DD')=to_char(p_day,'MM-DD')))
 order by e.at desc, e.id desc limit greatest(1,least(p_limit,100))
$$;

create or replace function public.story_memory_days(p_timezone text default 'UTC')
returns table(day text, year int, count bigint)
language plpgsql stable security invoker set search_path = '' as $$
declare c uuid := public.my_couple_id(); s record; parts text[] := '{}';
begin
 if auth.uid() is null or c is null then raise exception 'Couple membership required' using errcode='42501'; end if;
 for s in select * from (values
  ('media','taken_at','true'),
  ('list_items','done_at','done_at is not null'),
  ('events','starts_at','status=''confirmed'''),
  ('messages','created_at','kind=''text'' and coalesce(j->>''deleted_at'','''')='''' and (nullif(j->>''expires_at'','''') is null or (j->>''expires_at'')::timestamptz>now())')
 ) as v(tbl,dt,predicate) loop
  if to_regclass('public.'||s.tbl) is null then continue; end if;
  parts := array_append(parts,format('select to_char(t.%I at time zone $1,''MM-DD'') as day,extract(year from t.%I at time zone $1)::int as year,count(*)::bigint as n from public.%I t cross join lateral (select to_jsonb(t) j) x where t.couple_id=$2 and t.%I<=now() and (%s) group by 1,2',s.dt,s.dt,s.tbl,s.dt,s.predicate));
 end loop;
 if cardinality(parts)>0 then return query execute 'select q.day,q.year,sum(q.n)::bigint from ('||array_to_string(parts,' union all ')||') q group by 1,2' using p_timezone,c; end if;
end
$$;

-- Definer returns counts/groupings and aggregate timestamps only. Membership is
-- resolved from auth.uid(), never a caller-supplied ID. No raw private text.
create or replace function public.story_summary(p_year int default null, p_timezone text default 'UTC')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c uuid := public.my_couple_id(); s record; result jsonb := '{}'::jsonb; stats jsonb; dt_expr text;
 lo timestamptz; hi timestamptz;
begin
 if auth.uid() is null or c is null then raise exception 'Couple membership required' using errcode='42501'; end if;
 if p_year is not null and (p_year < 1900 or p_year > 2200) then raise exception 'Invalid year'; end if;
 perform now() at time zone p_timezone;
 lo := case when p_year is null then '-infinity'::timestamptz else make_date(p_year,1,1)::timestamp at time zone p_timezone end;
 hi := case when p_year is null then now() else least(now(),make_date(p_year+1,1,1)::timestamp at time zone p_timezone) end;
 for s in select * from (values
  ('messages','created_at','sender_id','0::numeric','null::text','kind <> ''system'' and coalesce(j->>''deleted_at'','''')='''' and (nullif(j->>''expires_at'','''') is null or (j->>''expires_at'')::timestamptz>now())',1000),
  ('media','created_at','uploader_id','0::numeric','null::text','true',1),
  ('calls','answered_at','caller_id','greatest(0,extract(epoch from (ended_at-answered_at)))','null::text','answered_at is not null and ended_at is not null',1),
  ('watch_sessions','created_at','host_id','0::numeric','null::text','status = ''ended''',10),
  ('chess_games','updated_at','white_id','0::numeric','j->>''winner_id''','status <> ''active''',1),
  ('scribble_matches','updated_at','created_by','0::numeric','(select case when count(*)=1 then min(key) else null end from jsonb_each_text(j->''scores'') where key <> ''_scribble'' and value::numeric=(select max(value::numeric) from jsonb_each_text(j->''scores'') where key <> ''_scribble''))','scores #>> ''{_scribble,phase}'' = ''final''',1),
  ('game_rounds','updated_at','created_by','0::numeric','j #>> ''{state,winner}''','status = ''finished''',1),
  ('list_items','done_at','done_by','0::numeric','null::text','done_at is not null and (hidden_from is null or hidden_from <> auth.uid() or revealed_at is not null) and exists(select 1 from public.lists l where l.id=t.list_id and l.couple_id=t.couple_id and l.kind=''bucket'')',1),
  ('pulse_answers','created_at','user_id','0::numeric','null::text','true',1),
  ('focus_log','day','user_id','0::numeric','null::text','true',1)
 ) as v(tbl,dt,person,secs,winner,predicate,nth) loop
  if to_regclass('public.'||s.tbl) is null then continue; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=s.tbl and column_name=s.dt) then continue; end if;
  dt_expr := format('t.%I',s.dt);
  if s.tbl='focus_log' then dt_expr := '(t.day::timestamp at time zone $4)'; end if;
  execute format($q$
   with rows as materialized (
    select %s as at, j->>%L as person, coalesce(j->>'kind',j->>'game','') as kind,
      %s as seconds, %s as winner
    from public.%I t cross join lateral (select to_jsonb(t) j) x
    where t.couple_id=$1 and %s >= $2 and %s < $3 and (%s)
   ) select jsonb_build_object(
    'total',count(*),'first_at',min(at),'photo_at',min(at) filter(where kind='photo'),'win_at',min(at) filter(where winner is not null),'threshold_at',(select min(at + (360000-(running-seconds))*interval '1 second') from (select at,seconds,sum(seconds) over(order by at) running from rows) accumulated where running>=360000 and running-seconds<360000),'nth_at',(select at from rows order by at offset %s limit 1),
    'seconds',coalesce(sum(seconds),0),'longest',coalesce(max(seconds),0),
    'by_day',coalesce((select jsonb_agg(g) from (select to_char(at at time zone $4,'YYYY-MM-DD') key,count(*)::int count from rows group by 1 order by 1) g),'[]'),
    'by_hour',coalesce((select jsonb_agg(g) from (select to_char(at at time zone $4,'HH24') key,count(*)::int count from rows group by 1 order by 1) g),'[]'),
    'by_person',coalesce((select jsonb_agg(g) from (select person key,count(*)::int count from rows where person is not null group by 1) g),'[]'),
    'by_kind',coalesce((select jsonb_agg(g) from (select kind key,count(*)::int count from rows group by 1) g),'[]'),
    'wins',coalesce((select jsonb_agg(g) from (select winner key,count(*)::int count from rows where winner is not null group by 1) g),'[]')
   ) from rows
  $q$,dt_expr,s.person,s.secs,s.winner,s.tbl,dt_expr,dt_expr,s.predicate,s.nth-1) into stats using c,lo,hi,p_timezone;
  result := result || jsonb_build_object(s.tbl,stats);
 end loop;
 return result;
end $$;
revoke all on function public.story_entries(timestamptz,text,int,text,date,text) from public,anon;
revoke all on function public.story_feed(timestamptz,text,int,text,date,text) from public,anon;
revoke all on function public.story_memory_days(text) from public,anon;
revoke all on function public.story_summary(int,text) from public,anon;
grant execute on function public.story_entries(timestamptz,text,int,text,date,text), public.story_feed(timestamptz,text,int,text,date,text), public.story_memory_days(text), public.story_summary(int,text) to authenticated;
commit;




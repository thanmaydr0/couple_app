-- Game night: all writes go through a row-locked, authenticated state machine.
begin;
create table if not exists public.game_rounds (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id),
 game text not null check (game in ('know','rather','roulette','connect')), state jsonb not null,
 status text not null default 'lobby' check (status in ('lobby','active','finished')),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists game_rounds_one_live on public.game_rounds(couple_id,game) where status <> 'finished';
create index if not exists game_rounds_history on public.game_rounds(couple_id,created_at desc);
create table if not exists public.game_stats (
 couple_id uuid not null references public.couples(id), game text not null, played integer not null default 0,
 wins_a integer not null default 0, wins_b integer not null default 0, extra jsonb not null default '{}', primary key(couple_id,game)
);
create table if not exists public.gamenight_choices (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id),
 round_id uuid not null references public.game_rounds(id) on delete cascade, step integer not null,
 author uuid not null references public.profiles(id), answer text not null check(length(answer) between 1 and 120),
 created_at timestamptz not null default now(), unique(round_id,step,author)
);
create index if not exists gamenight_choices_couple on public.gamenight_choices(couple_id,created_at desc);
create table if not exists public.gamenight_prompts (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id),
 game text not null check(game in ('know','rather','roulette')), category text not null check(length(category) between 1 and 40),
 text text not null check(length(text) between 1 and 500), options jsonb not null default '[]', kind text check(kind in ('truth','dare')),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 check(jsonb_typeof(options) = 'array'), check(jsonb_array_length(options) <= 4)
);
create index if not exists gamenight_prompts_couple on public.gamenight_prompts(couple_id,created_at desc);
alter table public.game_rounds enable row level security;
alter table public.game_stats enable row level security;
alter table public.gamenight_choices enable row level security;
alter table public.gamenight_prompts enable row level security;
revoke all on public.game_rounds, public.game_stats, public.gamenight_choices, public.gamenight_prompts from anon, authenticated;
grant select on public.game_rounds, public.game_stats, public.gamenight_choices, public.gamenight_prompts to authenticated;
grant insert, delete on public.gamenight_prompts to authenticated;
drop policy if exists gamenight_round_read on public.game_rounds;
create policy gamenight_round_read on public.game_rounds for select to authenticated using(couple_id = (select public.my_couple_id()));
drop policy if exists gamenight_stats_read on public.game_stats;
create policy gamenight_stats_read on public.game_stats for select to authenticated using(couple_id = (select public.my_couple_id()));
drop policy if exists gamenight_choice_read on public.gamenight_choices;
create policy gamenight_choice_read on public.gamenight_choices for select to authenticated using(
 couple_id = (select public.my_couple_id()) and (author = (select auth.uid()) or exists(
 select 1 from public.game_rounds r where r.id = round_id and r.couple_id = gamenight_choices.couple_id
 and (r.state->>'reveal')::boolean and (r.state->>'step')::integer = gamenight_choices.step)));
drop policy if exists gamenight_prompt_read on public.gamenight_prompts;
create policy gamenight_prompt_read on public.gamenight_prompts for select to authenticated using(couple_id = (select public.my_couple_id()));
drop policy if exists gamenight_prompt_insert on public.gamenight_prompts;
create policy gamenight_prompt_insert on public.gamenight_prompts for insert to authenticated with check(couple_id = (select public.my_couple_id()) and created_by = (select auth.uid())
 and not exists(select 1 from jsonb_array_elements(options) opt where jsonb_typeof(opt)<>'string' or length(opt#>>'{}') not between 1 and 120)
 and (select count(distinct opt) from jsonb_array_elements(options) opt)=jsonb_array_length(options)
 and ((game = 'know' and jsonb_array_length(options) in (0,4)) or (game = 'rather' and jsonb_array_length(options)=2) or (game='roulette' and kind is not null and category in ('sweet','funny','adventurous','deep') and jsonb_array_length(options)=0)));
drop policy if exists gamenight_prompt_delete on public.gamenight_prompts;
create policy gamenight_prompt_delete on public.gamenight_prompts for delete to authenticated using(couple_id = (select public.my_couple_id()) and created_by = (select auth.uid()));

create schema if not exists gamenight_private;
revoke all on schema gamenight_private from public, anon, authenticated;
create or replace function gamenight_private.valid_prompt(p jsonb,g text) returns boolean language plpgsql immutable set search_path = '' as $$
begin
 if p is null or jsonb_typeof(p)<>'object' or p->>'game' is distinct from g
  or jsonb_typeof(p->'text') is distinct from 'string' or length(trim(coalesce(p->>'text',''))) not between 1 and 500
  or jsonb_typeof(p->'options') is distinct from 'array' then return false; end if;
 if exists(select 1 from jsonb_array_elements(p->'options') opt where jsonb_typeof(opt)<>'string' or length(opt#>>'{}') not between 1 and 120) then return false; end if;
 if (select count(distinct opt) from jsonb_array_elements(p->'options') opt)<>jsonb_array_length(p->'options') then return false; end if;
 return case g when 'know' then jsonb_array_length(p->'options') in (0,4)
  when 'rather' then jsonb_array_length(p->'options')=2
  when 'roulette' then jsonb_array_length(p->'options')=0 and coalesce(p->>'kind','') in ('truth','dare') and coalesce(p->>'category','') in ('sweet','funny','adventurous','deep') else false end;
end $$;
-- Bounded edit-distance for server-authoritative typed answers. Fuse.js provides the UI hint.
create or replace function gamenight_private.close_answer(a text,b text) returns boolean language plpgsql immutable set search_path = '' as $$
declare x text := lower(regexp_replace(trim(normalize(a,NFKC)),'\s+',' ','g')); y text := lower(regexp_replace(trim(normalize(b,NFKC)),'\s+',' ','g'));
 prev integer[]; curr integer[]; i integer; j integer;
begin
 if x=y then return true; end if;
 if least(length(x),length(y))<4 or greatest(length(x),length(y))>120 then return false; end if;
 select array_agg(n) into prev from generate_series(0,length(y)) n;
 for i in 1..length(x) loop
  curr := array[i];
  for j in 1..length(y) loop curr := array_append(curr,least(curr[j]+1,prev[j+1]+1,prev[j]+case when substr(x,i,1)=substr(y,j,1) then 0 else 1 end)); end loop;
  prev:=curr;
 end loop;
 return prev[length(y)+1]::numeric / greatest(length(x),length(y)) <= 0.2;
end $$;

create or replace function gamenight_private.action(p_action text, p_round uuid default null, p_payload jsonb default '{}')
returns public.game_rounds language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
 uid uuid := auth.uid(); cid uuid := public.my_couple_id(); partner uuid; a uuid; b uuid;
 r public.game_rounds; s jsonb; g text; prompt jsonb; step integer; answer text; aa text; bb text;
 matched boolean; score integer; streak integer; winner uuid; finished boolean := false;
 board jsonb; col integer; row_n integer; cell integer; rr integer; cc integer; dr integer; dc integer; k integer; piece integer; line jsonb;
begin
 if uid is null or cid is null then raise exception 'Couple membership required'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>100000 then raise exception 'Invalid payload'; end if;
 select id into partner from public.profiles where couple_id=cid and id<>uid;
 if partner is null or (select count(*) from public.profiles where couple_id=cid)<>2 then raise exception 'Link both partners before playing'; end if;
 a := least(uid,partner); b := greatest(uid,partner);
 if p_action='start' then
  g:=p_payload->>'game'; prompt:=p_payload->'prompt';
  if g not in ('know','rather','roulette','connect') or g is null then raise exception 'Unknown game'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || g,0));
  select * into r from public.game_rounds where couple_id=cid and game=g and status<>'finished';
  if found then return r; end if;
  if g<>'connect' and not gamenight_private.valid_prompt(prompt,g) then raise exception 'Invalid prompt'; end if;
  -- Rebuild the public prompt: no arbitrary payload keys may become shared state.
  if g<>'connect' then prompt := jsonb_build_object('id',left(coalesce(prompt->>'id','custom'),100),'game',g,'category',left(coalesce(prompt->>'category','custom'),40),'text',prompt->>'text','options',prompt->'options') || case when g='roulette' then jsonb_build_object('kind',prompt->>'kind') else '{}'::jsonb end; end if;
  s:=jsonb_build_object('a',a,'b',b,'turn',uid,'step',0,'prompt',case when g='connect' then 'null'::jsonb else prompt end,'reveal',false,
    'scores',jsonb_build_object(a::text,0,b::text,0),'streaks',jsonb_build_object(a::text,0,b::text,0),'skips',jsonb_build_object(a::text,2,b::text,2),
    'board',to_jsonb(array_fill(0,array[42])),'line','[]'::jsonb,'winner',null,'matched',null,'spun',false,'completed','[]'::jsonb,'last',null);
  insert into public.game_rounds(couple_id,game,state,created_by) values(cid,g,s,uid) returning * into r;
  return r;
 end if;
 select * into r from public.game_rounds where id=p_round and couple_id=cid for update;
 if not found then raise exception 'Game not found'; end if;
 s:=r.state; g:=r.game; step:=(s->>'step')::integer;
 if uid::text not in (s->>'a',s->>'b') then raise exception 'Spectators cannot change a game'; end if;
 if r.status='finished' then raise exception 'This game has finished'; end if;
 if p_action='join' and r.status='lobby' then
  if uid=r.created_by then raise exception 'Waiting for your partner to join'; end if;
  update public.game_rounds set status='active',updated_at=clock_timestamp() where id=r.id returning * into r; return r;
 elsif p_action='cancel' and r.status='lobby' and uid=r.created_by then
  update public.game_rounds set status='finished',updated_at=clock_timestamp() where id=r.id returning * into r; return r;
 end if;
 if r.status<>'active' then raise exception 'Your partner must join first'; end if;
 if (p_payload->>'step')::integer is distinct from step then raise exception 'Game changed. Refresh and try again'; end if;
 if p_action='answer' and g in ('know','rather') and not (s->>'reveal')::boolean then
  answer:=trim(p_payload->>'answer');
  if answer is null or length(answer) not between 1 and 120 then raise exception 'Answer must be 1 to 120 characters'; end if;
  if jsonb_array_length(s->'prompt'->'options')>0 and not (s->'prompt'->'options' @> jsonb_build_array(answer)) then raise exception 'Choose one of the options'; end if;
  insert into public.gamenight_choices(couple_id,round_id,step,author,answer) values(cid,r.id,step,uid,answer);
  if (select count(*) from public.gamenight_choices where round_id=r.id and gamenight_choices.step=step)=2 then
   select c.answer into aa from public.gamenight_choices c where c.round_id=r.id and c.step=step and c.author=a;
   select c.answer into bb from public.gamenight_choices c where c.round_id=r.id and c.step=step and c.author=b;
   matched:=case when g='know' and jsonb_array_length(s->'prompt'->'options')=0 then gamenight_private.close_answer(aa,bb) else aa=bb end;
   s:=s || jsonb_build_object('reveal',true,'matched',matched);
   if g='know' then
    partner:=case when s->>'turn'=a::text then b else a end;
    score:=coalesce((s->'scores'->>partner::text)::integer,0)+case when matched then 1 else 0 end;
    streak:=case when matched then coalesce((s->'streaks'->>partner::text)::integer,0)+1 else 0 end;
    s:=jsonb_set(jsonb_set(s,array['scores',partner::text],to_jsonb(score)),array['streaks',partner::text],to_jsonb(streak));
   else streak:=0; end if;
   insert into public.game_stats(couple_id,game,extra) values(cid,g,jsonb_build_object('a',a,'b',b,'attempts',1,'matches',case when matched then 1 else 0 end,'best_streak',coalesce(streak,0)))
   on conflict(couple_id,game) do update set extra=game_stats.extra || jsonb_build_object('attempts',coalesce((game_stats.extra->>'attempts')::integer,0)+1,'matches',coalesce((game_stats.extra->>'matches')::integer,0)+case when matched then 1 else 0 end,'best_streak',greatest(coalesce((game_stats.extra->>'best_streak')::integer,0),coalesce(streak,0)));
  end if;
 elsif p_action='next' and g in ('know','rather','roulette') then
  if not (s->>'reveal')::boolean then raise exception 'Complete this round first'; end if;
  if step >= (case when g='roulette' then 7 else 9 end) then finished:=true;
  else
   prompt:=p_payload->'prompt';
   if not gamenight_private.valid_prompt(prompt,g) then raise exception 'Invalid prompt'; end if;
   prompt:=jsonb_build_object('id',left(coalesce(prompt->>'id','custom'),100),'game',g,'category',left(coalesce(prompt->>'category','custom'),40),'text',prompt->>'text','options',prompt->'options') || case when g='roulette' then jsonb_build_object('kind',prompt->>'kind') else '{}'::jsonb end;
   s:=s || jsonb_build_object('step',step+1,'turn',case when s->>'turn'=a::text then b else a end,'prompt',prompt,'reveal',false,'matched',null,'spun',false);
  end if;
 elsif p_action='spin' and g='roulette' and not (s->>'spun')::boolean and not (s->>'reveal')::boolean then
  if s->>'turn'<>uid::text then raise exception 'Wait for your turn'; end if;
  -- Server selects the wheel category; client supplies only a validated category pool.
  if jsonb_typeof(p_payload->'pool') is distinct from 'array' or jsonb_array_length(p_payload->'pool') not between 1 and 104 then raise exception 'Invalid spin pool'; end if;
  prompt:=(p_payload->'pool')->floor(random()*jsonb_array_length(p_payload->'pool'))::integer;
  if not gamenight_private.valid_prompt(prompt,'roulette') then raise exception 'Invalid spin prompt'; end if;
  prompt:=jsonb_build_object('id',left(coalesce(prompt->>'id','custom'),100),'game',g,'category',left(coalesce(prompt->>'category','sweet'),40),'text',prompt->>'text','options','[]'::jsonb,'kind',prompt->>'kind');
  s:=s || jsonb_build_object('prompt',prompt,'spun',true);
 elsif p_action in ('complete','skip') and g='roulette' and (s->>'spun')::boolean and not (s->>'reveal')::boolean then
  if s->>'turn'<>uid::text then raise exception 'Wait for your turn'; end if;
  if p_action='skip' then
   score:=(s->'skips'->>uid::text)::integer;
   if score<=0 then raise exception 'No skip tokens left. You can always end this game'; end if;
   s:=jsonb_set(s,array['skips',uid::text],to_jsonb(score-1));
  else
   s:=jsonb_set(s,array['scores',uid::text],to_jsonb((s->'scores'->>uid::text)::integer+1));
  end if;
  s:=s || jsonb_build_object('reveal',true,'completed',(s->'completed') || jsonb_build_array(jsonb_build_object('step',step,'text',s->'prompt'->>'text','skipped',p_action='skip','author',uid)));
 elsif p_action='end' and g='roulette' then finished:=true;
 elsif p_action='move' and g='connect' then
  if s->>'turn'<>uid::text then raise exception 'Wait for your turn'; end if;
  col:=(p_payload->>'column')::integer;
  if col is null or col not between 0 and 6 then raise exception 'Invalid column'; end if;
  board:=s->'board'; cell:=null;
  for row_n in reverse 5..0 loop if (board->>(row_n*7+col))::integer=0 then cell:=row_n*7+col; exit; end if; end loop;
  if cell is null then raise exception 'This column is full'; end if;
  piece:=case when uid=a then 1 else 2 end;
  board:=jsonb_set(board,array[cell::text],to_jsonb(piece)); line:='[]'::jsonb;
  for rr in 0..5 loop for cc in 0..6 loop for k in 0..3 loop
   dr:=case when k=0 then 0 else 1 end; dc:=case when k=1 then 0 when k=3 then -1 else 1 end;
   if rr+3*dr<=5 and cc+3*dc between 0 and 6 and (board->>(rr*7+cc))::integer=piece
    and (board->>((rr+dr)*7+cc+dc))::integer=piece and (board->>((rr+2*dr)*7+cc+2*dc))::integer=piece and (board->>((rr+3*dr)*7+cc+3*dc))::integer=piece then
    line:=jsonb_build_array(rr*7+cc,(rr+dr)*7+cc+dc,(rr+2*dr)*7+cc+2*dc,(rr+3*dr)*7+cc+3*dc);
   end if;
  end loop; end loop; end loop;
  if jsonb_array_length(line)>0 then winner:=uid; finished:=true;
  elsif not board @> '[0]'::jsonb then finished:=true; end if;
  s:=s || jsonb_build_object('board',board,'line',line,'last',cell,'step',step+1,'turn',case when uid=a then b else a end);
 else raise exception 'Action unavailable'; end if;
 if finished then
  if g in ('know','roulette') then
   if (s->'scores'->>a::text)::integer>(s->'scores'->>b::text)::integer then winner:=a;
   elsif (s->'scores'->>b::text)::integer>(s->'scores'->>a::text)::integer then winner:=b; end if;
  end if;
  s:=s || jsonb_build_object('winner',winner);
  insert into public.game_stats(couple_id,game,played,wins_a,wins_b,extra) values(cid,g,1,case when winner=a then 1 else 0 end,case when winner=b then 1 else 0 end,jsonb_build_object('a',a,'b',b))
  on conflict(couple_id,game) do update set played=game_stats.played+1,wins_a=game_stats.wins_a+excluded.wins_a,wins_b=game_stats.wins_b+excluded.wins_b;
 end if;
 update public.game_rounds set state=s,status=case when finished then 'finished' else 'active' end,updated_at=clock_timestamp() where id=r.id returning * into r;
 return r;
end $$;
-- Only this unprivileged wrapper is exposed in the Data API schema.
create or replace function public.gamenight_action(p_action text, p_round uuid default null, p_payload jsonb default '{}')
returns public.game_rounds language sql security invoker set search_path = '' as $$
 select gamenight_private.action(p_action,p_round,p_payload);
$$;
revoke all on function public.gamenight_action(text,uuid,jsonb) from public,anon;
grant execute on function public.gamenight_action(text,uuid,jsonb) to authenticated;
revoke all on function gamenight_private.action(text,uuid,jsonb) from public,anon;
grant usage on schema gamenight_private to authenticated;
grant execute on function gamenight_private.action(text,uuid,jsonb) to authenticated;
revoke all on function gamenight_private.close_answer(text,text) from public,anon,authenticated;
revoke all on function gamenight_private.valid_prompt(jsonb,text) from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['game_rounds','game_stats','gamenight_choices','gamenight_prompts'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
end $$;
commit;

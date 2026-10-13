-- Us Wallet. Requires 001_init, 002_storage, 100_infra. Safe to rerun.
create table if not exists public.wallet_recurring (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
 template jsonb not null check(jsonb_typeof(template)='object'), cadence text not null default 'monthly' check(cadence='monthly'), next_run date not null
);
create table if not exists public.wallet_expenses (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
 paid_by uuid not null references public.profiles(id), amount_minor bigint not null check(amount_minor between 1 and 1000000000000),
 currency text not null default 'INR' check(currency ~ '^[A-Z]{3}$'),
 category text not null check(category in ('food','groceries','rent','travel','fun','gifts','bills','health','other')),
 note text check(length(note)<=500), split_type text not null default 'equal' check(split_type in ('equal','percent','paid_for_partner','paid_for_me','custom')),
 split jsonb not null default '{}' check(jsonb_typeof(split)='object'), spent_on date not null default current_date,
 receipt_path text, recurring_id uuid references public.wallet_recurring(id) on delete set null,
 created_at timestamptz not null default now(), deleted_at timestamptz,
 check(receipt_path is null or receipt_path like couple_id::text || '/receipts/%'),
 check(split_type <> 'percent' or (split ? 'payer_bps' and (split->>'payer_bps')::numeric between 0 and 10000 and (split->>'payer_bps')::numeric=trunc((split->>'payer_bps')::numeric))),
 check(split_type <> 'custom' or (split ? 'payer_minor' and (split->>'payer_minor')::numeric between 0 and amount_minor and (split->>'payer_minor')::numeric=trunc((split->>'payer_minor')::numeric)))
);
create unique index if not exists wallet_recurring_occurrence on public.wallet_expenses(recurring_id,spent_on) where recurring_id is not null;
-- CHECK expressions must reject JSON null, which SQL otherwise treats as UNKNOWN/pass.
alter table public.wallet_expenses drop constraint if exists wallet_split_numbers;
alter table public.wallet_expenses add constraint wallet_split_numbers check(case split_type
 when 'percent' then coalesce(jsonb_typeof(split->'payer_bps')='number',false)
 when 'custom' then coalesce(jsonb_typeof(split->'payer_minor')='number',false) else true end);
create table if not exists public.wallet_settlements (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
 from_user uuid not null references public.profiles(id), to_user uuid not null references public.profiles(id),
 amount_minor bigint not null check(amount_minor between 1 and 1000000000000), currency text not null default 'INR' check(currency ~ '^[A-Z]{3}$'),
 settled_at timestamptz not null default now(), note text check(length(note)<=500), check(from_user<>to_user)
);
create table if not exists public.wallet_goals (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 80), emoji text not null default '🫙' check(length(emoji)<=16),
 target_minor bigint not null check(target_minor between 1 and 1000000000000), saved_minor bigint not null default 0 check(saved_minor between 0 and 9007199254740991),
 deadline date, created_by uuid not null default auth.uid() references public.profiles(id), unique(id,couple_id)
);
create table if not exists public.wallet_contributions (
 id uuid primary key default gen_random_uuid(), goal_id uuid not null, couple_id uuid not null references public.couples(id) on delete cascade,
 user_id uuid not null default auth.uid() references public.profiles(id), amount_minor bigint not null check(amount_minor between 1 and 1000000000000), created_at timestamptz not null default now(),
 foreign key(goal_id,couple_id) references public.wallet_goals(id,couple_id) on delete cascade
);
create index if not exists wallet_expenses_month on public.wallet_expenses(couple_id,spent_on desc) where deleted_at is null;
create index if not exists wallet_expenses_payer on public.wallet_expenses(paid_by);
create index if not exists wallet_settlements_couple on public.wallet_settlements(couple_id,settled_at);
create index if not exists wallet_settlements_from on public.wallet_settlements(from_user);
create index if not exists wallet_settlements_to on public.wallet_settlements(to_user);
create index if not exists wallet_goals_couple on public.wallet_goals(couple_id);
create index if not exists wallet_goals_creator on public.wallet_goals(created_by);
create index if not exists wallet_contributions_goal on public.wallet_contributions(goal_id,couple_id);
create index if not exists wallet_contributions_couple on public.wallet_contributions(couple_id,created_at);
create index if not exists wallet_contributions_user on public.wallet_contributions(user_id);
create index if not exists wallet_recurring_due on public.wallet_recurring(couple_id,next_run);
do $$ declare t text; begin
 foreach t in array array['wallet_expenses','wallet_settlements','wallet_goals','wallet_contributions','wallet_recurring'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('drop policy if exists wallet_read on public.%I',t);
  execute format('create policy wallet_read on public.%I for select to authenticated using(couple_id=(select public.my_couple_id()))',t);
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
grant insert(id,couple_id,paid_by,amount_minor,currency,category,note,split_type,split,spent_on,receipt_path) on public.wallet_expenses to authenticated;
grant update(paid_by,amount_minor,currency,category,note,split_type,split,spent_on,receipt_path,deleted_at) on public.wallet_expenses to authenticated;
drop policy if exists wallet_expense_insert on public.wallet_expenses;
create policy wallet_expense_insert on public.wallet_expenses for insert to authenticated with check(couple_id=(select public.my_couple_id()) and exists(select 1 from public.profiles p where p.id=paid_by and p.couple_id=wallet_expenses.couple_id));
drop policy if exists wallet_expense_update on public.wallet_expenses;
create policy wallet_expense_update on public.wallet_expenses for update to authenticated using(couple_id=(select public.my_couple_id())) with check(couple_id=(select public.my_couple_id()) and exists(select 1 from public.profiles p where p.id=paid_by and p.couple_id=wallet_expenses.couple_id));
grant insert(id,couple_id,title,emoji,target_minor,deadline,created_by) on public.wallet_goals to authenticated;
drop policy if exists wallet_goal_insert on public.wallet_goals;
create policy wallet_goal_insert on public.wallet_goals for insert to authenticated with check(couple_id=(select public.my_couple_id()) and created_by=(select auth.uid()) and saved_minor=0);
grant insert(id,goal_id,couple_id,user_id,amount_minor) on public.wallet_contributions to authenticated;
drop policy if exists wallet_contribution_insert on public.wallet_contributions;
create policy wallet_contribution_insert on public.wallet_contributions for insert to authenticated with check(couple_id=(select public.my_couple_id()) and user_id=(select auth.uid()));
-- Trigger-only definer: atomic increment, cannot be called as an API. Never trusts client saved_minor.
create or replace function public.wallet_goal_credit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.user_id<>auth.uid() or new.couple_id is distinct from public.my_couple_id() then raise exception 'Membership required'; end if;
 update public.wallet_goals set saved_minor=saved_minor+new.amount_minor where id=new.goal_id and couple_id=new.couple_id;
 if not found then raise exception 'Goal unavailable'; end if;
 return new;
end $$;
revoke all on function public.wallet_goal_credit() from public,anon,authenticated;
drop trigger if exists wallet_goal_credit on public.wallet_contributions;
create trigger wallet_goal_credit after insert on public.wallet_contributions for each row execute function public.wallet_goal_credit();
-- Serialize settlements against the current ledger, so two simultaneous taps cannot over-settle.
create or replace function public.wallet_settle(p_currency text, p_expected bigint, p_note text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid:=public.my_couple_id(); u uuid:=auth.uid(); partner uuid; b bigint; result uuid;
begin
 if u is null or c is null then raise exception 'Membership required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(c::text||p_currency,0));
 select id into partner from public.profiles where couple_id=c and id<>u;
 if partner is null or (select count(*) from public.profiles where couple_id=c)<>2 then raise exception 'Pair required'; end if;
 select coalesce(sum((case when paid_by=u then 1 else -1 end)*(amount_minor-(case split_type when 'equal' then (amount_minor+1)/2 when 'paid_for_partner' then 0 when 'paid_for_me' then amount_minor when 'custom' then (split->>'payer_minor')::bigint when 'percent' then round(amount_minor::numeric*(split->>'payer_bps')::numeric/10000)::bigint end))),0) into b from public.wallet_expenses where couple_id=c and currency=p_currency and deleted_at is null;
 select b+coalesce(sum(case when from_user=u then amount_minor else -amount_minor end),0) into b from public.wallet_settlements where couple_id=c and currency=p_currency;
 if b=0 or b<>p_expected then raise exception 'Balance changed; refresh before settling'; end if;
 insert into public.wallet_settlements(couple_id,from_user,to_user,amount_minor,currency,note) values(c,case when b>0 then partner else u end,case when b>0 then u else partner end,abs(b),p_currency,p_note) returning id into result;
 return result;
end $$;
revoke all on function public.wallet_settle(text,bigint,text) from public,anon;
grant execute on function public.wallet_settle(text,bigint,text) to authenticated;
-- All ledger writes take the same lock as settlement, including scheduler inserts.
create or replace function public.wallet_ledger_lock() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and old.currency<>new.currency then
  perform pg_advisory_xact_lock(hashtextextended(new.couple_id::text||least(old.currency,new.currency),0));
  perform pg_advisory_xact_lock(hashtextextended(new.couple_id::text||greatest(old.currency,new.currency),0));
 else perform pg_advisory_xact_lock(hashtextextended(new.couple_id::text||new.currency,0)); end if;
 return new;
end $$;
revoke all on function public.wallet_ledger_lock() from public,anon,authenticated;
drop trigger if exists wallet_ledger_lock on public.wallet_expenses;
create trigger wallet_ledger_lock before insert or update on public.wallet_expenses for each row execute function public.wallet_ledger_lock();
grant insert(id,couple_id,template,cadence,next_run), delete on public.wallet_recurring to authenticated;
drop policy if exists wallet_recurring_insert on public.wallet_recurring;
create policy wallet_recurring_insert on public.wallet_recurring for insert to authenticated with check(couple_id=(select public.my_couple_id()) and template->>'paid_by'=(select auth.uid())::text);
drop policy if exists wallet_recurring_delete on public.wallet_recurring;
create policy wallet_recurring_delete on public.wallet_recurring for delete to authenticated using(couple_id=(select public.my_couple_id()));
create or replace function public.wallet_schedule() returns trigger language plpgsql security definer set search_path='' as $$
declare t jsonb; amount numeric; bps numeric; share numeric;
begin
 if tg_op='DELETE' then
  update public.scheduled_jobs set status='cancelled' where couple_id=old.couple_id and kind='recurring_expense' and payload->>'recurring_id'=old.id::text and status='pending'; return old;
 end if;
 if auth.uid() is null or new.couple_id is distinct from public.my_couple_id() or new.template->>'paid_by'<>auth.uid()::text then raise exception 'Membership required'; end if;
 t:=new.template; amount:=(t->>'amount_minor')::numeric;
 if amount is null or amount<1 or amount>1000000000000 or amount<>trunc(amount)
  or coalesce(t->>'currency','') !~ '^[A-Z]{3}$'
  or coalesce(t->>'category','') not in ('food','groceries','rent','travel','fun','gifts','bills','health','other')
  or coalesce(t->>'split_type','') not in ('equal','percent','paid_for_partner','paid_for_me','custom')
  or coalesce(jsonb_typeof(t->'split'),'')<>'object'
  or length(coalesce(t->>'note',''))>500 or (t->>'spent_on')::date is null then raise exception 'Invalid recurring template'; end if;
 if t->>'split_type'='percent' then
  bps:=(t->'split'->>'payer_bps')::numeric;
  if bps is null or bps<0 or bps>10000 or bps<>trunc(bps) then raise exception 'Invalid recurring percentage'; end if;
 elsif t->>'split_type'='custom' then
  share:=(t->'split'->>'payer_minor')::numeric;
  if share is null or share<0 or share>amount or share<>trunc(share) then raise exception 'Invalid recurring custom share'; end if;
 end if;
 insert into public.scheduled_jobs(couple_id,kind,run_at,payload,created_by) values(new.couple_id,'recurring_expense',new.next_run::timestamp at time zone 'UTC',jsonb_build_object('recurring_id',new.id,'due',new.next_run),auth.uid()); return new;
end $$;
revoke all on function public.wallet_schedule() from public,anon,authenticated;
drop trigger if exists wallet_schedule_insert on public.wallet_recurring;
create trigger wallet_schedule_insert after insert on public.wallet_recurring for each row execute function public.wallet_schedule();
drop trigger if exists wallet_schedule_delete on public.wallet_recurring;
create trigger wallet_schedule_delete after delete on public.wallet_recurring for each row execute function public.wallet_schedule();
-- Worker-only RPC: insert + advance + enqueue in one transaction; retries return existing occurrence.
create or replace function public.wallet_run_recurring(p_job uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.scheduled_jobs; r public.wallet_recurring; e public.wallet_expenses; due date; following date; t jsonb;
begin
 select * into j from public.scheduled_jobs where id=p_job and kind='recurring_expense';
 if j.id is null then raise exception 'Job unavailable'; end if;
 due:=(j.payload->>'due')::date;
 select * into r from public.wallet_recurring where id=(j.payload->>'recurring_id')::uuid and couple_id=j.couple_id for update;
 if r.id is null then return null; end if;
 select * into e from public.wallet_expenses where recurring_id=r.id and couple_id=r.couple_id and spent_on=due;
 if e.id is not null then return to_jsonb(e); end if;
 if due<>r.next_run or due>current_date then return null; end if;
 t:=r.template;
 if not exists(select 1 from public.profiles where id=(t->>'paid_by')::uuid and couple_id=r.couple_id) or j.created_by<>(t->>'paid_by')::uuid then return null; end if;
 insert into public.wallet_expenses(couple_id,paid_by,amount_minor,currency,category,note,split_type,split,spent_on,recurring_id)
 values(r.couple_id,(t->>'paid_by')::uuid,(t->>'amount_minor')::bigint,coalesce(t->>'currency','INR'),t->>'category',t->>'note',coalesce(t->>'split_type','equal'),coalesce(t->'split','{}'),due,r.id) returning * into e;
 -- Anchor day comes from original template, avoiding permanent drift after February.
 following:=least((date_trunc('month',due)+interval '2 months - 1 day')::date,(date_trunc('month',due)+interval '1 month')::date+(extract(day from (t->>'spent_on')::date)::int-1));
 update public.wallet_recurring set next_run=following where id=r.id;
 insert into public.scheduled_jobs(couple_id,kind,run_at,payload,created_by) values(r.couple_id,'recurring_expense',following::timestamp at time zone 'UTC',jsonb_build_object('recurring_id',r.id,'due',following),j.created_by);
 return to_jsonb(e);
end $$;
revoke all on function public.wallet_run_recurring(uuid) from public,anon,authenticated;
grant execute on function public.wallet_run_recurring(uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('wallet-receipts','wallet-receipts',false,5242880,array['image/jpeg']) on conflict(id) do nothing;
drop policy if exists wallet_receipts_read on storage.objects;
create policy wallet_receipts_read on storage.objects for select to authenticated using(bucket_id='wallet-receipts' and (storage.foldername(name))[1]=(select public.my_couple_id())::text and (storage.foldername(name))[2]='receipts');
drop policy if exists wallet_receipts_insert on storage.objects;
create policy wallet_receipts_insert on storage.objects for insert to authenticated with check(bucket_id='wallet-receipts' and (storage.foldername(name))[1]=(select public.my_couple_id())::text and (storage.foldername(name))[2]='receipts');
drop policy if exists wallet_receipts_delete on storage.objects;
create policy wallet_receipts_delete on storage.objects for delete to authenticated using(bucket_id='wallet-receipts' and (storage.foldername(name))[1]=(select public.my_couple_id())::text and (storage.foldername(name))[2]='receipts');

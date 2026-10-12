-- Shared infrastructure. Safe to rerun; feature migrations start at 110.
alter table public.couples add column if not exists timezone text default 'Asia/Kolkata';
alter table public.profiles add column if not exists timezone text;
alter table public.profiles add column if not exists birthday date;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists lat double precision;
alter table public.profiles add column if not exists lon double precision;
alter table public.profiles add column if not exists privacy jsonb default '{}'::jsonb;
-- Existing owner-only UPDATE RLS remains in effect. Membership is immutable.
grant update (timezone, birthday, city, lat, lon, privacy) on public.profiles to authenticated;

create table if not exists public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null,
  run_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending','done','failed','cancelled')),
  attempts int not null default 0 check (attempts >= 0),
  last_error text,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  locked_until timestamptz
);
create index if not exists scheduled_jobs_due_idx on public.scheduled_jobs (run_at, locked_until) where status = 'pending';
create index if not exists scheduled_jobs_couple_idx on public.scheduled_jobs (couple_id, run_at);
create index if not exists scheduled_jobs_creator_idx on public.scheduled_jobs (created_by);
alter table public.scheduled_jobs enable row level security;
revoke all on public.scheduled_jobs from anon, authenticated;
grant select on public.scheduled_jobs to authenticated;
grant insert (id, couple_id, kind, run_at, payload, created_by) on public.scheduled_jobs to authenticated;
grant update (status) on public.scheduled_jobs to authenticated;
grant all on public.scheduled_jobs to service_role;
drop policy if exists scheduled_jobs_select on public.scheduled_jobs;
create policy scheduled_jobs_select on public.scheduled_jobs for select to authenticated using (couple_id = (select public.my_couple_id()));
drop policy if exists scheduled_jobs_insert on public.scheduled_jobs;
create policy scheduled_jobs_insert on public.scheduled_jobs for insert to authenticated with check (
  couple_id = (select public.my_couple_id()) and created_by = (select auth.uid())
  and status = 'pending' and attempts = 0 and locked_until is null and last_error is null
);
drop policy if exists scheduled_jobs_cancel on public.scheduled_jobs;
create policy scheduled_jobs_cancel on public.scheduled_jobs for update to authenticated
  using (couple_id = (select public.my_couple_id()) and status = 'pending' and locked_until is null)
  with check (couple_id = (select public.my_couple_id()) and status = 'cancelled');

-- Service-only invoker RPC: lock and lease in ONE database transaction.
-- attempts also acts as a fencing token for completion by a stale worker.
create or replace function public.claim_scheduled_jobs(batch_size int default 20)
returns setof public.scheduled_jobs language plpgsql security invoker set search_path = '' as $$
begin
  update public.scheduled_jobs set status = 'failed', last_error = 'Worker lease expired after final attempt', locked_until = null
    where status = 'pending' and attempts >= 3 and locked_until < now();
  return query
    with due as (
      select id from public.scheduled_jobs
      where status = 'pending' and run_at <= now() and attempts < 3
        and (locked_until is null or locked_until < now())
      order by run_at, id for update skip locked limit greatest(1, least(batch_size, 50))
    )
    update public.scheduled_jobs j set locked_until = now() + interval '5 minutes', attempts = j.attempts + 1
      from due where j.id = due.id returning j.*;
end;
$$;
revoke all on function public.claim_scheduled_jobs(int) from public, anon, authenticated;
grant execute on function public.claim_scheduled_jobs(int) to service_role;

create or replace function public.finish_scheduled_job(job_id uuid, claim_attempt int, failure text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare updated int;
begin
  update public.scheduled_jobs set
    status = case when failure is null then 'done' when attempts >= 3 then 'failed' else 'pending' end,
    run_at = case when failure is null then run_at else now() + interval '1 minute' * attempts end,
    last_error = left(failure, 500), locked_until = null
    where id = job_id and status = 'pending' and attempts = claim_attempt and locked_until > now();
  get diagnostics updated = row_count;
  return updated = 1;
end;
$$;
revoke all on function public.finish_scheduled_job(uuid, int, text) from public, anon, authenticated;
grant execute on function public.finish_scheduled_job(uuid, int, text) to service_role;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scheduled_jobs'
  ) then alter publication supabase_realtime add table public.scheduled_jobs; end if;
end $$;

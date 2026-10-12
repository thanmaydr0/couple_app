# Shared scheduler

**Deployment completed 2026-10-12 UTC / 2026-10-13 IST** on project
`tlqedvktbgaipzhdgsuy`. Migration applied; pg_cron/pg_net enabled; CRON_SECRET
saved in Edge Function secrets and the same value in Vault; scheduler and
notify-partner deployed; minute cron active. Both cron delivery responses and
direct authenticated invocation returned HTTP 200 with zero pending jobs.
Missing cron secret returned 401. The steps below are reproducible setup
documentation; no manual setup remains for the current project.

Setup order (performed by the infrastructure session when connected access is available):

1. Run `migrations/100_infra.sql` in SQL Editor. It is idempotent. Existing
   profile owner RLS and existing feature tables remain unchanged.
2. Enable `pg_cron` and `pg_net` in Database → Extensions, or run:
   `create extension if not exists pg_cron; create extension if not exists pg_net with schema extensions;`
   Supabase Vault must also be enabled (hosted projects include it).
3. Generate a cryptographically random 32-byte secret. Set **CRON_SECRET** in
   Edge Functions → Secrets. Never put this in Expo, Git, logs, or cron command text.
4. Store that SAME value using `vault.create_secret` with name
   **scheduler_cron_secret**. Store the project HTTPS URL under
   **scheduler_project_url**. Use `vault.update_secret` when rotating existing values.
5. Deploy `scheduler` with JWT verification **off**: it authenticates every
   POST using `x-cron-secret`. Deploy `notify-partner` keeping JWT verification
   **on**, preserving its verified user/couple checks.
6. Run `cron.sql`. It schedules one invocation each minute. Secrets are read
   from Vault at runtime; the job command does not contain credentials.
7. Verify unauthenticated requests return 401 and authenticated empty runs
   return `{claimed:0,completed:0,recorded:0}`. Check `cron.job_run_details`
   AND `net._http_response` for successful delivery (cron success alone only
   confirms queuing). Do not print request headers or Vault plaintext.

## Jobs and feature ownership

Authenticated members can read their couple's jobs, insert jobs attributed to
themselves, and cancel pending, unclaimed jobs by changing **only status** to
`cancelled`. Clients cannot edit attempts, lease, payload, kind, time or creator.
Execution/finish RPCs are callable only by service_role. Claims use `FOR UPDATE
SKIP LOCKED`, five-minute leases, and attempt fencing. Failed work is retried
after 1/2 minutes and becomes failed at three attempts; expired final leases
also become failed. Cancel before a claim; execution already in flight cannot
be cancelled. Handlers must check current feature consent before side effects.

Each reserved handler throws until its feature implements it. Do not enqueue
stub kinds in production. No handler may silently consume unsupported work.
Feature owners edit their own handler file; imports are already wired for
capsule_unlock, scheduled_message, plan_reminder, countdown, recurring_expense,
daily_digest and disappearing_purge. Add a new kind through a shared session.

Delivery is **at least once**: a worker can die after an external side effect
and before completion. Each handler must deduplicate using `job.id`, scope all
admin queries by `job.couple_id`, validate payloads, resolve recipients from
membership, honor `context.signal`, and finish within 30 seconds. Use an outbox
or provider idempotency key for external side effects. Future handler work must
not extend the invocation deadline or log sensitive payloads.

`needsNative` in the registry is planning metadata, not a permission grant.
Providers remain inert until feature implementation and explicit consent.

References: [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions),
[Vault](https://supabase.com/docs/guides/database/vault),
[Expo push payloads](https://docs.expo.dev/push-notifications/sending-notifications/),
[Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api).

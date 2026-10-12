# Shared feature infrastructure — 2026-10-13 IST

## (a) What was built

- Appended the requested FEATURE RULES verbatim to AGENTS.md.
- Reserved all 20 feature folders, screens, types, per-feature configs and
  `/us/<id>` routes. Registry includes group, icon, migration and native metadata.
  Every config defaults to disabled. Future owners enable themselves and attach
  HomeCard/SettingsSection through their own config without editing the registry.
- Added protected nested Us navigation, themed hub, Home carousel/card slots,
  Games registry entries, Settings extension slots and per-account local hiding.
  Existing Home destinations, Chess, Scribble and profile fields retain their
  original logic. Five inert feature providers are mounted in the app shell.
- Added couple-scoped Query/Realtime list and optimistic mutation helpers using
  the existing authenticated client; background cleanup, reconnect refresh,
  mutation account checks and immutable row/couple identity protection.
- Added couple/device timezone helpers, DST-aware conversion that rejects
  ambiguous/skipped times, and motion-respecting optional haptic patterns.
- Added opt-in city selection via Open-Meteo, birthday and editable detected
  timezone. City OFF directly removes city/coordinates; no device location
  permission or tracking is introduced. New fields preserve old profile fields.
- Added scheduled_jobs with RLS/column grants, indexes, Realtime publication,
  service-only claim/finish RPCs, SKIP LOCKED leases, fencing and bounded retries.
  Seven reserved handlers deliberately fail until implemented; none silently
  marks unimplemented work done. Handlers must deduplicate by job.id.
- Extended notify-partner while preserving existing verified caller, partner,
  call TTL and message/test behavior. Added six Android channels, allowlisted
  data.route taps, optional priority/data-only payloads and a new rate-limited
  client helper. No device notification was sent during verification.
- Installed only requested JS dependencies: fuse.js, plus world-atlas,
  topojson-client and d3-geo as dev dependencies. Existing zod was reused.
  No native dependency or native folder was changed.

## (b) How I verified it

- `npx tsc --noEmit`: clean.
- `npx expo export --platform android`: passed (Hermes Android bundle).
- `npx expo-doctor`: 19/21 checks passed. Existing InCallManager/WebRTC
  New Architecture metadata warnings and nine Expo patch-version mismatches
  remain. Native package upgrades were outside the permitted JS-only installs.
- Deno checked scheduler and notify-partner; 3 database/backend tests passed,
  including running infrastructure SQL twice, RLS, column grants, cancellation,
  leases, retries, stale completions and backward-compatible auth behavior.
- 17 Node tests passed for list scoping/background cleanup/stale accounts,
  timezone/DST conversion, Android channels, notifications and legacy behavior.
- Hosted rolled-back RLS test passed: own-couple insertion/cancellation allowed;
  payload rewrites, client completion, claim RPC and cross-couple inserts denied;
  outsider could not read jobs. No test jobs remain.
- Both real accounts authenticated and could read added profile columns and
  scheduled jobs. Invalid notification channels/routes were rejected with 400
  before any push was sent. Open-Meteo returned Bengaluru with timezone/coordinates.
- Live scheduler: authenticated POST 200, no secret 401. cron.job is active;
  cron.job_run_details succeeded; net._http_response confirmed real HTTP 200
  responses, with no timeouts and `{claimed:0,completed:0,recorded:0}`.
- Security advisors: no new table/RPC RLS/access findings. Warnings are
  pg_net's public extension namespace (non-relocatable after installation),
  the existing intentional my_couple_id security-definer helper, and existing
  disabled leaked-password protection. No existing authentication behavior changed.

Reproduce checks:

```powershell
npx tsc --noEmit
node --test src/lib/couple-time.test.cjs src/lib/data/useRealtimeTable.test.cjs src/features/notifications/server.test.cjs src/features/notifications/policy.test.cjs src/features/notifications/registration.test.cjs
npx deno check --config supabase/deno.json supabase/functions/notify-partner/index.ts supabase/functions/scheduler/index.ts
npx deno test --config supabase/deno.json --allow-env --allow-read --allow-net supabase/tests/infra_test.ts supabase/tests/backend_test.ts
pwsh -File supabase/tests/live-infra.ps1
npx expo export --platform android
```

The live PowerShell check uses the private local credentials file; it does not
print credentials, mutate profiles, or send notifications. Run live-infra.sql
in SQL Editor to repeat the transaction-only hosted policy test.

## (c) Could not verify without a device

Android rendering/touch targets/font scaling/keyboard behavior, native haptics,
push receipt/display/tap routing on cold launch, Android channel settings, and
real background/foreground transitions. Export is not an APK/device test.
Future feature handlers and native features remain intentionally unimplemented.

## (d) SQL to run, in order

**Already executed against the current project; no user action required.**

1. `supabase/migrations/100_infra.sql` (applied through connected Supabase).
2. Enable pg_cron and pg_net; retain hosted Vault.
3. Provision matching scheduler_cron_secret and scheduler_project_url in Vault.
4. After deploying scheduler, execute `supabase/cron.sql`.

Only infrastructure SQL was applied. 110–370 are reserved for future owners;
touch and book reserve no migration. See src/features/README.md for assignments.

## (e) Edge Functions to deploy

**Already deployed:** scheduler (version 1, custom x-cron-secret auth,
verify_jwt=false) and notify-partner (version 7, verify_jwt=true).
CRON_SECRET is stored server-side only. Supabase injects service credentials;
none are included in app code or committed files.

## (f) Manual steps for the user

**None for setup.** Extensions, function secret, Vault entries, deployment and
minute cron were completed automatically and verified. Full repeatable setup
steps are in supabase/README_SCHEDULER.md. Device-only checks below remain
unverified because no Android device session is connected.

## (g) Regression checklist

- Sign in/out with each existing account; unpaired/auth gates still apply.
- Home partner presence, calls, anniversary counter, destinations and recent
  calls retain their behavior; new sections remain absent with disabled features.
- Chess, Scribble, Chat, Memories and Watch still open and work on two devices.
- Existing name/avatar/anniversary saving still works. New birthday/timezone
  saving works; city selection requires saving; city OFF removes coordinates.
- In a future feature session, enable its own config: verify hub/carousel/game
  group/card/settings slots. Hide and restore it under Settings → Features;
  verify the choice survives restart and is separate for each account.
- Full/Reduced/Off motion, screen reader labels, large fonts, offline/retry,
  keyboard and Android back navigation remain usable.
- Message/call/test pushes retain behavior; new route pushes open allowed
  destinations only after account/couple checks. Data-only delivery is device-
  dependent. Signed-out users cannot access new Us routes.
- Feature Realtime stops in background and resyncs on resume; optimistic failures
  reconcile without crossing couple or account boundaries.
- Minute scheduler stays HTTP 200 while idle; implement only allocated handlers
  before enqueueing work. Monitor terminal failures and keep handlers idempotent.

## (h) Needs shared change

No blocking shared change remains for the 20 isolated feature sessions.
N0 must provide native libraries before native-dependent features are enabled.
Existing Expo patch mismatches and WebRTC/InCallManager compatibility need a
dedicated native dependency maintenance/device verification session.

The new shared ComingSoon, feature slots, registry types and preference store
are in src/features/shared and src/features; feature owners may import them but
must request any changes through a shared session. Pre-existing staged Movie
changes were preserved and excluded from this infrastructure commit.

Advisor references:
[extension namespace](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[security-definer execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

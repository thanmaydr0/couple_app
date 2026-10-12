# Time Capsule

Route: `/us/capsule`. Feature-local implementation follows the shared Warm Glow screen composition, theme tokens, motion preferences, Screen/Header and PressableScale.

## Built

- Received stub list and authored list; server-sourced countdowns; foreground refresh and active-only polling.
- Composer with title, paragraphs, six compressed JPEGs, quick dates, anniversary-in-N-years, feature-local calendar/time controls and Open together.
- UTC storage with explicit couple timezone and rejection of ambiguous/skipped local times. Device time never authorizes reads or mutations.
- SVG wax seal/crack, envelope opening, paper unfolding/typewriter, floating photos and shared Burst. Reduced/Off suppress spatial and decorative motion/haptics.
- Authenticated server holds, distinct member checks, one-second minimum overlap and three-second stale-hold expiry. Realtime presence is a visual readiness hint, never authorization. Presence and hold heartbeat stop in background; release/unmount clear the hold.
- `voice_path` and `CapsuleVoiceExtension` are the voice-session extension point; the private bucket supports voice MIME types. No recorder is built.
- Author-only editing/deletion before unlock; immutable afterward, including after opening.

## Database and deployment

Order: existing `001_init.sql` / storage foundations, `100_infra.sql`, then `130_capsule.sql`. Migration 130 was applied to the connected Couple_app project on 2026-10-13 and its SQL tests passed. The scheduler capsule handler was deployed in scheduler version 2, preserving the other live handlers and entrypoint. Its existing cron runs once per minute.

Media uses the **private `capsules` bucket**, with `<couple_id>/capsules/<capsule_id>/<file>` keys. The shared `media` bucket permits broad couple reads, so using it would leak sealed attachments. Definer RPCs have an empty search path, explicit authenticated grants and couple checks. The security advisor flags those intentional authenticated definer entrypoints; they are required for safe stubs and the opening ceremony. No anonymous execution is granted.

## Verification

- `npx tsc --noEmit`: final whole-project check passed (exit 0). Earlier transient errors in other sessions were not edited here.
- `npx expo-doctor`: 19/21; shared Expo patch mismatches and existing call-library New Architecture metadata warnings. No installs or native builds performed.
- `node src/features/capsule/verify-handler.mjs`: scoped lookup, member resolution, deleted/rescheduled job suppression, notify-partner request, failure propagation and cancellation.
- Deployed scheduler boot check: unauthorized POST returned 401 as expected.
- `node src/features/capsule/verify-live.mjs`: both existing user accounts; sealed full-row/title/photo signing/download/list denial; early opening and forged ceremony denial; transactional job rescheduling/cancellation; distinct overlapping holds; partner read after opening; edit/delete denied after unlock. All fixtures from this run were removed through the administrative connection.
- `src/features/capsule/security-tests.sql`: complete rollback-only SQL Editor test, already executed successfully. Proves author access, partner sealing, stub privacy, media helper checks, ceremony column protection, anonymous grant denial, unlocked access, outsider denial and immutable-after-unlock behavior. It simulates JWT subjects under `authenticated`, so it does not accidentally test as postgres.

The live script prints fixture IDs because unlocked capsules cannot be deleted by app users; an administrative test runner must clean those fixtures. It never prints passwords/tokens. SQL Editor tests roll back automatically.

## Device verification still unavailable

Android layout/large text, native gallery permissions, actual compression/upload rendering, haptic crescendo, Reanimated/Skia rendering, two-device latency/disconnect behavior, Android background transitions and system notification delivery require devices. No device or native build was available in this run.

## Manual steps

No database setup or handler deployment is left for the user. SQL deployment, security tests and test-data cleanup were performed through the connected Supabase account. Shared integration below is still required before declaring the whole feature shipped.

## Regression checklist

- Partner sealed `select('*')` returns zero rows; stub exposes no body/paths and a null title.
- Partner cannot list, download or sign sealed media; author can.
- Unrelated/anonymous callers cannot retrieve stubs or open capsules.
- Moving the device clock or timezone never grants early access.
- Together capsules remain hidden after time unlock until two authenticated holds overlap.
- One user with two devices cannot satisfy two distinct member holds; stale holds expire.
- Leaving/backgrounding releases the seal; foregrounding refreshes server time.
- Editing unlock time cancels the previous job; deleting cancels the pending job.
- Opened/unlocked content cannot be edited/deleted by either app user.
- Reduced/Off disables loops, spatial animation and extra haptics.
- Six-photo limit, failed save retry, offline draft retention, DST and anniversary/birthday quick picks.

## Needs shared change

1. Home owner must import/render `CapsuleHomeCard` from this feature. Shared Home is outside this session's allowed paths. No new shared component files were added.
2. `notify-partner` currently **only accepts user JWTs**. The scheduler's service client cannot call it successfully. Add a service-authenticated scheduler contract accepting `scheduler_job_id`; resolve the author/recipient from that job, validate couple/current unlock time/status and deduplicate delivery by job ID. Do not trust arbitrary recipient IDs. The deployed handler sends `{channel,title,body,data:{route,capsule_id,job_id},scheduler_job_id}` and propagates failure so the scheduler never records false delivery. Until this integration exists, unlock pushes fail; foreground unlocking works. Do not display a “Notified on unlock” success claim yet.
3. Current cron cadence is one minute and Expo/Android delivery is best effort. Exact-time delivery requires shared scheduler changes; it cannot be promised by this handler.
4. Shared notification navigation must forward `capsule_id` to `/us/capsule`; the route already consumes that parameter.
5. Shared infra currently allows either member to cancel pending jobs through its generic scheduled_jobs policy. Harden ownership/feature-job cancellation if reminders must be protected from partner cancellation.
6. Dependency alignment/doctor warnings belong to the dedicated shared/native session.

## Practical limits

The server can attest two distinct authenticated holds with short leases; it cannot attest a physical finger from a modified client. Release loss can leave a hold valid for at most three seconds. Uploading photos is multi-step: files are uploaded after capsule creation and attached before save success. The draft stays visible on failure and cleanup is attempted, but an unlock/network loss during upload can leave a partial capsule or orphan object. Deleting photos immediately before row deletion also has a boundary race at unlock. A shared Storage cleanup/outbox service would be needed for full transactional object lifecycle guarantees. Opened photos use short-lived signed URLs and may need a retry after expiry.

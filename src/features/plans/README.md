# Plans implementation and verification

## Built

- Shared month calendar, multi-day dots, agenda and day sheet; event create/edit/delete sheets; weekly/monthly/yearly expansion. Series edits affect the whole series. Month/year end dates clamp to the last valid day.
- Computed read-only anniversary, both profile birthdays and day 100/365/1000 entries.
- Countdown cards, animated days/hours, ticking seconds, motion-aware arrival burst, one atomic Home pin. Accepting a proposal atomically creates an associated countdown; deleting/moving its event deletes/moves that countdown.
- Opt-in local reminders per phone, scoped reconciliation without touching other features' notifications, up to the next 60 reminders over 90 days, replenished at startup, foreground and event changes. Explicit disable and sign-out cancel Plans alarms.
- Feature registry initializes the device service at cold start, including deep links. One foreground Realtime channel per phone; no broadcasts or background connection. Permission prompts occur only after the user's Enable action.
- Weekly availability editor with hour cells, hold/drag selection, explicit Save and Clear all. Saving replaces only the caller's availability atomically. UTC-minute intersection produces five windows of at least 30 minutes within 35 days, displayed in both profile timezones. One tap proposes; partner can Accept/Counter/Decline.
- Date-night picker reads unfinished items from Our Lists `kind='dates'`; missing tables/columns/empty ideas fall back gracefully.
- DST gap/fold input rejection; repeat occurrences in skipped/ambiguous wall times are omitted. UTC civil dates for all-day entries, with reminders relative to 09:00 on each recipient's civil day. Missing profile zones visibly fall back to the device zone; profiles must have accurate IANA zones for accurate partner clocks.
- RLS, grants, constraints, indexes, Realtime publication, private trigger functions and service-only job validation/continuation. Source changes cancel even claimed stale jobs; workers recheck source and membership.

## Verification

- `npx tsc --noEmit`: passed after implementation.
- `node --test src/features/plans/time.test.cjs src/features/plans/runtime.test.cjs`: 12 tests pass. Covers DST, fractional offsets, monthly/leap-year repeats, all-day dates, generated entries, five overlap windows, scoped/idempotent local scheduling, deletion, worker cancellation/deadline checks and retry/continuation behavior.
- `verification.sql`: executed against the connected project inside BEGIN/ROLLBACK. Verified RLS, rejection of self acceptance, partner acceptance/countdown creation, two reminder jobs, atomic pinning, availability ownership, rescheduling and deletion cleanup. No test fixtures persisted.
- A second rolled-back database check verified server recurrence across the March 2027 New York DST transition and idempotent repeated continuation calls.
- Supabase security advisor: no Plans findings. Existing unrelated project warnings were left untouched.
- `npx expo-doctor`: 19/21 pass. Existing New Architecture warnings for incall-manager/webrtc and seven SDK patch mismatches. No dependencies installed or changed, no native build/export.

## SQL (already applied)

`supabase/migrations/150_plans.sql` was applied to `tlqedvktbgaipzhdgsuy` after existing migrations 001 and 100. It is idempotent. Do not rerun other sessions' migrations as part of Plans setup.

## Edge Functions (already deployed)

The existing `scheduler` was deployed with only `handlers/plan_reminder.ts` and `handlers/countdown.ts` replaced in the previously deployed bundle. Existing unrelated remote handlers were preserved. Scheduler cron is active. Source handlers must ship inside the scheduler bundle, not as standalone endpoints.

## Device verification still required

Android notification permission/exact-alarm behavior, background/force-stop delivery, drag selection, keyboard/sheet gestures, small-screen/large-font layout, TalkBack, both-phone Realtime delivery, actual push receipt and arrival animation cannot be validated from TypeScript or database tests. An offline or suspended phone cannot learn a remote deletion until it reconnects; pending local reminders can still fire before that sync. The foreground service cancels them immediately when it learns the deletion.

## Manual setup

No SQL, deployment or development setup remains for the user. OS notification consent is an in-app opt-in on each phone; it cannot be silently granted from the development session.

## Regression checklist

- Two accounts: propose, counter, accept and decline; self acceptance denied; acceptance creates one countdown and schedules both recipients.
- Move/delete a confirmed recurring series; original alarms/jobs cancel, new times appear; delete while scheduler has claimed a job.
- Switch one profile zone across a DST boundary; compare both clocks, overlap ranges and reminders. Test Kolkata/New York and Lord Howe folds.
- Save/clear availability independently; partner cannot overwrite it. Missing/empty Lists still permits a date proposal.
- Pin A then B; only B appears on Home. Let a countdown reach zero in Full/Reduced/Off motion.
- Enable/disable reminders, sign out, cold-start through a deep link, return from background, lose/recover network; other features' alarms remain untouched.

## Needs shared change

1. **Push fallback is blocked by `notify-partner`'s existing user-JWT-only authentication.** Add a verified service scheduler contract accepting `scheduler_job_id`; look up the job, its current source and couple membership server-side, derive the recipient as the other member from `job.created_by`, deduplicate side effects by job ID, and support channel `plans`. The handlers intentionally throw/retry on the current 401 rather than report delivery. Repeat push jobs continue after a successful delivery; until this contract exists, failed jobs cannot deliver or continue their series.
2. For deletion cancellation while a phone is suspended, shared notification/background integration must consume a data-only Plans change push and cancel/resync the corresponding local IDs. Android force-stop/offline cases still require next foreground sync. Foreground/cold-start cancellation is implemented here.
3. Expo Doctor dependency patch updates/New Architecture review belong to the shared dependency session.

Feature-local reusable components: `CountdownCard`, `AvailabilityGrid`, `EventEditor`. They use shared theme/motion tokens and can be extracted by a shared session if needed; no shared UI files were edited.

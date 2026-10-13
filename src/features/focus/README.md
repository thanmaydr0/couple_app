# Focus Rooms

The existing `/us/focus` route now contains the room and garden views. Feature config enables the existing registry HomeCard slot. No shared files or dependencies changed.

## Protocol

`focus_start` creates a server timestamp and enrolls the creator. `focus_join` enrolls the partner; joining credits the room's completed work cycles (shown in the garden). `focus_sync` locks the session, derives complete cycles from the database clock, and upserts deterministic plant IDs. Only enrolled users get stats. Final work ends the session; there is no final break. Ending early freezes completed-cycle rewards. Session history is append-only and the database enforces at most one active room per couple.

Both clients measure a server clock anchor against `performance.now()`. Rendering derives the phase from that anchor and `started_at`; it never decrements a counter. Resume and a 30-second refresh recalibrate the anchor. Server reconciliation recovers all elapsed work cycles when both phones were backgrounded, rather than relying on a JS background timer. Stats and streaks use UTC completion dates, explicitly labeled in the UI. Garden art is original SVG geometry, with four deterministic species and per-cycle positions. The ring uses Skia and Reanimated values. Reduced/off motion settings suppress spatial growth; only recent first-screenful plants animate.

Private authenticated channels enforce couple membership via `realtime.messages` policies. Presence only tracks explicitly joined rooms in the foreground. Cheers are sent only while the partner is present, throttled to one per three seconds, and never persisted. Postgres Changes listens only to session changes; phase updates are local calculations.

Local phase notifications use deterministic identifiers and replace only Focus's scheduled requests. Android permission is requested through the explicit Enable phase reminders action. Invitations use the existing notify-partner function's supported `messages` category, with a one-minute client cooldown and no sensitive session label in the push.

## Verification

Run `node src/features/focus/verify.cjs` for deterministic timer and stats checks, and `npx tsc --noEmit` for the workspace. Migration: `supabase/migrations/180_focus.sql` (after the base membership schema). No new Edge Function is required.

Verified against the configured hosted project: migration applied and rerun successfully; `verify.sql` passed server start/join, catch-up, duplicate rewards, early end, natural completion, cross-couple RPC/RLS and write-permission assertions. All test fixtures were rolled back. Twelve pure timer/statistics assertions passed. Focus had no TypeScript errors. Expo Doctor passed 19/21 checks; existing Expo patch mismatches and WebRTC/New Architecture metadata warnings remain outside this feature's ownership.

The security advisor reports Focus's authenticated SECURITY DEFINER endpoints. This exposure is intentional: clients cannot directly write sessions or rewards, so RPCs enforce authentication, membership, validated durations and immutable reward accounting using an empty search path. Anonymous/public execution is revoked. See the [advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Device checklist: two phones start/join, check both-here presence, cheer/haptics, work-to-rest transition, background/resume with differing wall clocks, denied notification permission, early end on each phone, disconnect/reconnect, concurrent starts, restart during a cycle, dark/light theme, reduced/off motion, screen reader and large text.

## Needs shared change / limits

Immediate cancellation of another phone's OS-scheduled notifications while it is suspended requires a shared background notification handler/native integration. Focus removes stale reminders on reconnect/resume; a suspended phone may still show a stale reminder before that. Android's power-saving policies can delay scheduled notifications, and JS does not execute phase haptics while suspended. No native builds were run.

The existing shared notification allowlist has no `focus` remote-push category. Invitations use `messages`; adding a dedicated category/preferences belongs to the notification owner. Existing theme/components are reused, with feature-only Ring and Garden; neither needs promotion to shared UI.

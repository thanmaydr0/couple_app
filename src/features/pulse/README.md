# Pulse

Pulse is enabled through `config.ts`; the existing registry renders its HomeCard and the existing root layout mounts PulseProvider. No shared source, native files or dependencies were changed.

## Built

- 365 original PG-13 questions, selected by a stable ordinal of the couple's timezone date. Leap days do not repeat or skip the cycle. Immutable daily answers reveal side by side only after both answer; past dates unlock automatically. History pages show 20 days at a time, with a shared streak. Answer reads page through the backend so long histories are not silently truncated.
- Eight one-tap moods, six availability choices and an optional note. Partner check-ins include a timestamp so a saved status does not imply online presence.
- Tap/hold heartbeats over private `pulse:<couple_id>` with presence enabled. Hold continuation is capped at one broadcast per 900ms, only while the partner is present. A hold counts once. The root provider removes channels on background and receives haptics through the shared motion-aware pattern. Closed-app notifications use the existing notify-partner function, with a persistent 10-minute client cooldown. Daily-answer pushes have a persistent per-user/day cooldown.
- Their Day uses F0's shared city/timezone/coordinates. Weather is explicitly off until enabled per signed-in user/partner on this device. Enabling sends city coordinates to Open-Meteo; the visible off control stops further requests. Weather caches for 30 minutes. Skia sky includes gradient, sun/moon, stars and weather-driven clouds; drift is enabled only at Full motion. Displays local date/time, DST-aware time difference, temperature, condition and sunrise/sunset.
- Home card, sealed-answer state, offline/error/empty/loading feedback and feature-local components using shared theme/motion/UI.

## Verification

- `npx --no-install tsc --noEmit`: passed after Pulse changes.
- `node src/features/pulse/verify.cjs`: 365 unique prompts, complete leap-year cycle, leap-day streaks, concurrent push deduplication, persistent cooldown, presence gating, hold counting, throttle and background suppression passed.
- `verify-rls.sql`: executed against the configured project under authenticated role with temporary couple/member/partner/outsider fixtures. Passed own-answer reads, blind reveal, past unlock, timezone boundary, spoof/future/withdrawal denial, status ownership, heartbeat counts and private broadcast isolation. Transaction rolled back; zero fixtures remain.
- All three Pulse tables are in supabase_realtime. Security advisor returned no Pulse findings. Unrelated project findings concern existing public definer functions, pg_net and leaked-password protection; these were left to their owners. See [Supabase linter guidance](https://supabase.com/docs/guides/database/database-linter).
- Live Open-Meteo response checked using synthetic coordinates; current weather and daily sunrise/sunset fields match the parser. The implementation follows [Open-Meteo forecast docs](https://open-meteo.com/en/docs) and [Supabase private Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).
- Expo Doctor ran once: 19/21 checks passed. Existing seven Expo patch-version mismatches and New Architecture metadata warnings for react-native-incall-manager/react-native-webrtc remain.
- `adb devices` found no attached Android device. No native build/export was run.

## Deployment and manual steps

`supabase/migrations/110_pulse.sql` was applied to the configured Supabase project as `pulse_daily_touchpoint`. No SQL remains to run. No new Edge Functions are required; uses existing notify-partner and the existing Android pulse notification channel. No manual setup is required from the user.

City sharing and weather consent are personal opt-ins and were not enabled on anyone's behalf. Missing city links to the existing Settings guidance.

## Device regression checklist

Not verified without an attached device: Android keyboard/layout and AA visual inspection at large text; touch/hold gesture cancellation; actual haptic strength; push arrival on registered phones; two-device presence reconnect/background lifecycle; Reduced/Off rendering; Skia rendering across themes.

When devices are available, verify A's answer remains sealed to B until B answers; both reveal; midnight resets the question/draft; Android Back returns from history; status propagates; holding counts once and stops on release/background; foreground partner receives overlay/haptic; absent partner gets at most one push per ten minutes; weather stays off until opted in, turns off, and missing-city/offline states stay readable.

## Integration exports

`sendHeartbeat(sustained?, continuation?)` is exported from `index.ts` for the widget session. It resolves the authenticated couple itself if the app-wide transport is absent; calls in background are suppressed. `setAvailability(availability)` preserves existing mood/note and supplies defaults only for a first check-in. PulseProvider and HomeCard are also exported.

## Needs shared change

None for Pulse integration. Shared dependency maintenance owns Expo Doctor's pre-existing package/version warnings. Feature-local HeartButton, StatusCard and TheirDay stay in this folder; they can be promoted by a future shared UI session if needed.

Client rate limits prevent accidental repeated notifications, not malicious API callers or multi-device bypass. The shared notify-partner backend would need server-side idempotency/rate limits for that stronger guarantee.

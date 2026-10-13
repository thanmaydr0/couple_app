# Story of Us

Built only in `src/features/story/**` and `supabase/migrations/190_story.sql`.
The existing `app/us/story.tsx` re-export already points to this screen. No shared
source, native folders, dependencies, or other features' data were changed.

## What is available

- Home On-this-day card, historical media/messages/completions/events carousel,
  and December Wrapped teaser. Wrapped can also be opened for any selected year.
- Read-only milestone calculations, celebration Burst on opening a milestone,
  milestone shelf, and anniversary chapters.
- FlashList timeline with filters, expandable memories, signed media previews,
  month headers with motion-aware bounded parallax, and date/ID keyset pagination.
  SQL limits each source before the global merge. Only the first screenful enters
  with animation. Lists retain cached data offline and expose retry actions.
- Full-screen Wrapped with progress, tap-to-pause, previous/next controls, SVG
  graphics, hour clock, foreground-aware timer, and explicit reading controls
  when animation is off or a screen reader is enabled.
- Skia native-view snapshot -> temporary PNG -> expo-media-library gallery asset
  -> expo-sharing when available. Capture waits for the memory image to settle;
  temporary files are removed afterward. Nothing is uploaded by this action.
- Optional local reminders default OFF, with an indicator and off switch in
  Story and Settings. Only dates with prior-year memories get a 9AM one-shot
  notification in the couple timezone. A rolling 30-day plan refreshes on initial
  auth and app foreground, including deep-link starts, through the existing
  PushProvider -> registry -> story/config import path. Repeated refreshes are
  limited to once per minute. Disabling/logout cancels only Story notifications.
  Notification bodies contain no private message/photo content. This is local
  scheduling, so there is no notify-partner Edge Function call or Realtime cost.

## Definitions and practical limits

- Anniversary day milestones use calendar days in the couple timezone. February
  29 anniversaries use February 28 in non-leap years. The 1,000-hour milestone
  means elapsed hours since the anniversary, explicitly labeled in the card;
  it is not inferred from location or physical co-presence.
- Finished answered calls contribute actual answered-to-ended seconds. The
  100-hour milestone uses the cumulative crossing time. Overlapping call records
  are counted separately. Movies count ended watch sessions, rather than
  claiming a full video was watched (the watch schema has no completion percent).
- Bucket milestone celebrates the first bucket completion and includes the
  current total. Individual completed list items appear in the timeline.
- The longest streak counts consecutive local dates with retained messages.
  Deleted/expired messages are excluded; disappearing-message deletion means
  all historical message statistics describe retained data, not deleted history.
- Games count decisive wins by person. Scribble uses persisted final scores and
  ties have no winner. Missing feature tables are skipped dynamically.
- Most active day combines daily activity counts across available nonfinancial
  sources. Top memory is the earliest photo added in that year, labeled as such.
- Emoji is a sample of existing React Query message-cache text, deduplicated by
  message ID and filtered by couple/year/deletion/expiry/send status. No extra
  message history is fetched, copied to disk, or sent to an aggregate function.
- On-this-day shows up to 40 recent highlights, rather than loading every message
  from that date. A new/deleted memory affects reminders at the next refresh.
  Opening the app after 30 days renews the local notification horizon. Android
  battery restrictions may delay notification delivery.
- The projection functions use source RLS. Only story_summary is SECURITY
  DEFINER, as requested: it has an empty search_path, explicit auth.uid() and
  my_couple_id() checks, a fixed source allowlist, and no caller-supplied couple
  ID. It returns counts, groups, sums/maxima and aggregate dates, never message
  bodies/capsule contents/financial data. PUBLIC and anon execution are revoked.
  No new tables require RLS/publication/index setup. Existing source indexes are
  used; no other feature's tables, grants, indexes, or policies are changed.

## Verification completed

- `node src/features/story/verify.cjs`: passed domain and native-adapter-mocked
  scheduler checks for streaks, leap years, DST, thresholds, cache privacy,
  duplicate messages, optional recap sections, default-off reminders, exact
  9AM dates, refresh deduplication, failure recovery, logout and unrelated jobs.
- `npx tsc --noEmit`: clean on the completed working-tree check (other concurrent
  sessions may introduce unrelated errors later).
- `npx --no-install expo-doctor`: run once, 19/21 checks passed. Existing shared
  warnings: react-native-incall-manager/react-native-webrtc New Architecture
  metadata and seven Expo patch-version mismatches. No packages were installed.
- Applied the migration to the connected Couple_app Supabase project, then ran
  `verify.sql` as authenticated with existing membership: count/RLS parity,
  stable one-row pagination against the merged feed, historical date filtering,
  missing tables, yearly/all-time and timezone queries, financial exclusion,
  anonymous EXECUTE denial and unpaired-user rejection all passed. Tests read
  existing rows only and roll back their session settings.
- Supabase security advisor reviewed. Story's authenticated definer-execution
  notice is intentional and guarded as above; other findings belong to existing
  project configuration. Reference:
  https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Figma frame 6:259 fetch was attempted but the connector hit its Starter quota.
  Styling follows the existing local Memories specimens and DESIGN_DIRECTION.md
  with live theme/motion tokens; no claim of a live Figma visual match is made.

## Deployment and device verification

SQL is already deployed: `190_story.sql` is the consolidated, idempotent source.
Remote migration history also records the incremental verification fixes; no
user SQL action is needed. There are no Edge Functions to deploy. No manual
backend setup remains and no shared file changes are needed for integration.

An Android device is still needed to verify actual permission dialogs, 9AM
notification delivery under battery restrictions, cold/deep-link routing,
FlashList gesture/scroll performance, all themes and text scaling, native
Skia capture (including embedded SVG/photos), gallery persistence and Android
share-sheet behavior. No local native build or expo export was run.

Regression checklist: On-this-day match/no-match; a new and unpaired account;
all timeline filters and pagination; locked capsule/hidden surprise exclusion;
all milestone thresholds and leap anniversary; missing Game Night/Focus tables;
Wrapped zero/populated/year-boundary data; Reduced/Off and screen-reader controls;
background/resume and pause; image failure/retry; reminders OFF/ON/denied/logout;
share permission denial, saving, cancellation and gallery result.

## Needs shared change

No Story integration change or dependency is required. Remediate the existing
Expo Doctor patch-version and native-library compatibility findings in a
separately authorized dependency/native session.

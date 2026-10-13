# Watch YouTube Together

Android feature entry: `YouTubeEntry` exported by `src/features/yt/index.ts`.
Route: `/us/yt`. Existing custom-scheme links can pass `text` or `url`, for
example `us://us/yt?text=<URL-encoded shared text>`. Clipboard paste and ordinary
pasted share text work without a new dependency. No native folder was edited.

## Behavior

- Watch, youtu.be, shorts, live and embed video links are parsed with a strict
  hostname allowlist and 11-character video id validation. A playlist-only URL
  uses the public IFrame API to resolve up to 50 unique video ids, then validates
  each available title through the public oEmbed endpoint. A watch URL containing
  `v` and `list` adds the selected video; use `/playlist?list=…` to import a list.
- Previews use oEmbed titles and canonical YouTube thumbnails. No oEmbed HTML is
  executed. Unavailable playlist entries are skipped. Private playlists fail with
  a useful message rather than a fabricated list. Imports require confirmation
  through Start together / Add to Up next after preview.
- One active session per couple. Both can add, reorder, remove, play, pause, seek,
  select rate, skip and end. Queue changes compare both the previous JSON queue
  and current video id in the database. Conflicting edits ask for refresh and
  retry rather than silently overwriting. Queue addition deduplicates videos
  already playing or queued. The host coordinates automatic next-video changes;
  either participant can skip. The next video starts only after both are ready.
- Recent history is bounded to 20 opened videos, stored only on this phone and
  scoped by couple id. Clear recent history removes it. It is an opened-video
  history, not proof that someone completed a video. Presence uses signed avatar
  URLs, with initials as a fallback; landscape hides the queue and history.
- `<Screen>`, shared Header, `useTheme`, `PressableScale`, 48dp controls and
  `useMotion` are used. Reactions float in Full, fade in Reduced, and appear
  immediately in Off. Lists have no insertion animation. Rotation preserves the
  mounted player and restores the previous orientation policy when leaving.

## Sync protocol

Private `yt:<session_id>` channels have couple-scoped read/write policies. Events:
`play(pos)`, `pause(pos)`, `seek(pos)`, `rate`, `load(videoId)`,
`heartbeat(pos,state)`, `buffering`, `ended`, plus `ready`, `ping`, `pong`,
`reaction` and `leave`. The persisted session row is the authority for video and
queue selection; load announces player readiness for that video. Database
changes refresh the session; foreground polling every 15 seconds repairs missed
changes. A failed queue action never claims success.

The independent sync engine adapts the movie feature's ideas without importing
it: NTP-style ping/pong clock offset, minimum-RTT latency sample, sequence
deduplication, deterministic counter/client ordering for simultaneous controls,
and heartbeat repair for lost transport packets. Positions more than **1 second**
apart hard-seek. Smaller drift uses brief pulses at the nearest supported
YouTube rate, then restores the chosen rate. YouTube rounds unsupported rates
such as 1.03 back toward 1, so continuous 1.03/0.97 nudges are not assumed to work.
Videos exposing only one rate cannot be nudged; they still hard-seek above 1s.

Both-ready gates play/seek/rate. Either buffering pauses both, while the host
coordinates a guarded restart; “Watching together” is shown only after both
report playing. A 25-second timeout leaves an explicit retry/skip message rather
than an endless waiting state. Missing peer heartbeats pause after 16 seconds.
Broadcasts require foreground, connection and partner presence, heartbeats are
every 4 seconds, ping every 30 seconds, reactions are rate-limited, and all
broadcast packets share a ceiling of 15 per second. Background sends stop after
the final pause/leave, presence is untracked, and the wake lock is released.

## YouTube limits

**Ads can briefly desync playback.** The public IFrame API does not expose a
reliable ad-state event. Buffering and playing state are used conservatively;
the feature cannot identify every ad or guarantee synchronized ad completion.
It never blocks/skips ads, hides branding, or overlays controls on the iframe.
The YouTube UI remains usable alongside app controls. Embedded autoplay can be
blocked by the device; retry Play or tap the YouTube player to start. Creator
embedding restrictions, removed/private videos, age/sign-in restrictions,
HTML5 errors and client-identity error 153 have clear messages plus skip/retry.

YouTube's native scrubber/rate controls are not a reliable source of cross-device
seek/rate events. Use the app's ±10s and speed controls for synchronized changes.
Native play/pause transitions are bridged outside the command acknowledgement
window. Android WebView integrity, ad behavior, tap-to-play restrictions and
embedded playlist availability must be verified on devices.

Reference: [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)
and [Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast).

## Deployment and verification

`supabase/migrations/320_yt.sql` follows the existing couples/profiles and
`my_couple_id()` foundation. It is idempotent. It was applied directly to the
configured Couple_app project, including RLS, four policies, private room
authorization, indexes and publication. No Edge Function or key is needed.
The project security advisor reported no yt-specific findings; existing
shared-project findings were left to their owners.

Commands (no installs, export or native build):

```text
npx --no-install tsc --noEmit
npx --no-install expo-doctor
node src/features/yt/verify.mjs --live-oembed
node src/features/yt/verify-live.mjs
```

The deterministic suite covers URL validation, shared text and playlists,
readiness gating, either-person controls, seek/rate/reaction delivery, the 15Hz
ceiling, background silence, 4.5-second clock skew, latency, drift correction,
buffer recovery, peer timeout, next-video autoplay, duplicate/wrong-video
isolation, IFrame bridge and player errors. Live public oEmbed passed.

The live suite uses existing private verification credentials without logging
them, creates its own test row, refuses to interrupt an existing active party,
and deletes only that row in finally. It verifies both accounts' access,
presence, all 13 private events in both directions, queue compare-and-swap,
cross-couple reassignment denial, anonymous/unknown room denial, and persisted
session end delivery. The first run saw a Postgres Changes timeout shortly after
publication setup; subsequent verification passed. No test rows remain.

Expo Doctor passed 19/21 checks: existing incall-manager/webrtc New Architecture
warnings and seven Expo patch-version mismatches. No dependencies were changed.
TypeScript errors in other sessions' owned folders are not changed here.

## Device regression checklist

- Two linked Android accounts: join, both-ready gate, play/pause from either,
  seek both directions, rate, simultaneous controls, skip and end.
- Add watch/short/share text/public playlist; invalid/private/unembeddable video;
  oEmbed/thumbnail failure; queue reorder/remove, simultaneous edits, and next
  autoplay. Verify creator-disabled, private/removed and error-153 messages.
- Buffer either device, trigger ads, interrupt Wi-Fi, background/foreground,
  kill/reopen, reconnect, leave the route, and verify no playback while absent.
- Portrait/landscape rotation without restarting the player, wake lock cleanup,
  avatar fallback, readable queue, 48dp controls, large fonts and AA theme pairs.
- Full/Reduced/Off motion and system reduced motion; reaction rate limiting;
  recent history clear and isolation after changing couples.

No Android device was connected during this session. These are remaining device
checks, not a claim of playback validation. All accessible backend/manual setup
was performed; no SQL or Edge Function deployment action is left for the user.

## Needs shared change

- Add the Watch tab's **File | YouTube** switch and render `YouTubeEntry`, or link
  to `/us/yt`. Shared tab/navigation files were outside this session's ownership.
- Android OS Share → Us delivery needs manifest/config and share-intent receiver
  work in the dedicated native session. Clipboard/share-text paste and route
  parameters work now; no native share receiver is claimed.
- Expo Doctor version alignment belongs to the shared dependency/native session.
  `YtButton` and `YtCard` remain feature-local token-based components; no shared UI
  extraction is required, but they can be adopted by a future shared UI task.

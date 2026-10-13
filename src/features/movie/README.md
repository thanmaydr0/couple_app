# Watch together (Android)

Both partners choose a video file already stored on their own phone. **DRM and streaming-app videos (Netflix, Prime Video, Disney+, etc.), including their offline downloads, cannot be used. Only unprotected device files are supported.** No movie bytes, local URI, thumbnail, or file contents are uploaded or broadcast. The session stores the filename/title, byte size, duration and couple membership. Realtime carries playback state, timestamps, readiness and emoji reactions.

The file picker requests `video/*` without a cache copy. An independent `expo-video` player probes duration/video tracks, then releases its resources. If an Android content URI cannot play directly, the app tries one cache copy and probes it again. Unknown byte sizes or invalid durations block selection. Cache copies are temporary and Android can remove them; the original is never deleted. Choose downloaded files from the device, not a cloud-only document provider.

Joining requires equal byte sizes and duration difference at most 1,000 ms. A mismatch shows both values and blocks playback. “I know it's a different cut, continue anyway” requires a second confirmation. This verifies metadata, not content identity: equal sizes/durations do not prove identical bytes. Use copies of the exact same original. Different cuts can never have matching scenes guaranteed by time synchronization.

## Synchronization

- Private `watch:<session_id>` channel using the shared Supabase client. Watch table RLS and Realtime policies check the caller's couple. Partners can both control playback.
- Both phones must be connected, in the foreground, have a playable file, and exchange readiness before play or seek. Native controls, background playback and notifications are disabled; custom controls explicitly broadcast actions. Native callbacks do not rebroadcast remote play/seek operations.
- `play`, `pause`, `seek`, `ready`, `heartbeat`, `end`, plus `ping`, `pong`, `reaction`, `leave`. Positions are **seconds**; database durations and timestamps are **milliseconds**. Each packet carries actor/client identity, sequence and a Lamport control stamp. Simultaneous actions converge by counter then client ID. The most recent controller leads; the other phone follows. The host supplies the initial resume position.
- Ping/pong at join/discovery and every 30 seconds estimate RTT/2 and peer clock offset using four timestamps. Lowest RTT among the last eight samples reduces queuing bias. Playing targets include estimated transit time; paused targets receive no time compensation. Heartbeats every 4 seconds recover dropped control state. Followers seek for absolute drift greater than 0.6 seconds and nudge at 1.03/0.97 until within 0.2 seconds, then restore 1.0.
- Loading/buffering pauses both, preserves the intent to resume and exchanges readiness. The host coordinates automatic resume at the stalled position after both recover. Play/resume does not seek again when already aligned; paused heartbeats do not repeatedly seek. Pending native seeks broadcast their requested position until the decoder catches up. A 3-second lack of progress pauses both without inventing an unready state: press Play or **Reconnect / retry playback**. Native loading that lasts 20 seconds cancels auto-resume and shows retry guidance. Explicit pause cancels automatic resume. Backgrounding or leaving pauses without automatic resume; after returning, press Play. Missing partner heartbeats pause after 12 seconds. Local delivery errors immediately disable playback until reconnect.
- Session end persists `ended` and broadcasts `end`; reconnect and a 10-second status check catch missed end events. Session rows and local files are retained. Leave an open session (instead of ending it) to resume next time. The last position is stored locally per account/session every 4 seconds and on exit, after file preparation succeeds. The host's last position wins when both return. Android force-kill can lose the latest 4 seconds. Remembered URIs are reprobed; expired permissions/cache require reselecting the file. Mismatch overrides are never silently reused.

This is best-effort time synchronization, **not a frame-perfect guarantee**. Asymmetric networks, decoder/keyframe seek precision, CPU load, Bluetooth audio and different cuts can affect perceived alignment. The diagnostics show estimated one-way latency and follower drift. No software-only claim of perfect synchronization is made without two-device measurement.

## Backend setup and checks

The base schema already contains `watch_sessions`, its couple RLS, grants, and Realtime publication. `setup.sql` supplies only Watch's private broadcast read/write policies and has been applied to the configured Couple_app Supabase project. Future environments must apply the base schema first, then this feature SQL. No Firebase service is needed for local-file Watch playback.

No shared files, dependencies or native folders are changed. Existing installed modules provide playback, document picking, orientation, keep-awake, storage and slider controls.

Run from the repository root:

```powershell
node src/features/movie/verify.mjs
node src/features/movie/verify-hook.mjs
node src/features/movie/verify-live.mjs
npx --no-install tsc --noEmit
```

The deterministic simulation covers metadata boundaries, drift thresholds, readiness, a 90-second clock skew, either controller, conflicting controls, buffering, reconnect, backgrounding, reactions and end. The live check uses existing ignored local test credentials without printing them, tests both authenticated partners and anonymous/unknown-channel rejection, creates one isolated test session, and deletes only its own test row afterward. No movie file is needed or transferred. Neither check replaces the device checklist in `TESTING.md`.

API references: [Expo Video](https://docs.expo.dev/versions/latest/sdk/video/), [DocumentPicker](https://docs.expo.dev/versions/latest/sdk/document-picker/), [Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast), [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).

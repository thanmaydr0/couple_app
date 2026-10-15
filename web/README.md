# Us web

Separate browser frontend for the existing Android app. Includes admin-created account login, a couple dashboard, live text chat and local movie watching. No calls. Android source, native projects, root manifests and backend schema are unchanged.

## Run locally

From `C:\5thsem\Projects\couple_app\web`:

```powershell
npm start
```

First run `npm ci --ignore-scripts` inside `web/` to install the pinned media engine (the existing repository dependencies must also be installed). Then `npm start` builds and opens a loopback server at http://127.0.0.1:4173. After editing source, restart the server or run `npm run build`, then reload the browser. No hot reload is configured. The first build downloads approximately 22 MB of pinned, SHA-256-verified WebAssembly codecs; later builds use the local cache. TypeScript, Supabase and crypto still use the existing repository packages. Root package manifests are unchanged.

The build reads only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the root `.env`, then `web/.env`, then the process environment. Override with `web/.env` using `.env.example` if needed. Only these public values enter `dist/config.js`. Secret/service-role keys are rejected. Never put admin credentials or a Metered key here.

## Features and boundaries

- **Login:** existing email/password accounts; persistent browser session; local sign-out; pairing gate with retry. No signup or reset flow is invented.
- **Dashboard:** actual partner name, anniversary when configured, chat and movie entry points, four existing theme palettes. No fabricated online status or sample content.
- **Chat:** text sends, stable client IDs for retry after ambiguous failures, live insert/update/delete events, 50-message history pages, seen receipts for readable text in a focused tab, in-memory failed sends, partner notification rate limiting. Plaintext photos and voice messages are viewable. Deleted, expired and view-once content is protected. History and drafts are not persisted to browser storage.
- **Encrypted chat:** uses the Android encryption protocol directly. Restore your existing recovery backup with its passphrase and compare the displayed safety number with your partner's Android Privacy screen before sending. No new keys are registered or encryption settings changed. Private keys live only in tab memory and clear when leaving Chat, locking or signing out. Encrypted attachments and view-once media must be opened in Android. Browser text chat works with encryption on or off.
- **Watch:** uses a browser media engine (libmedia AVPlayer), with its own container demuxer, worker-based decoding, hardware/WebCodecs acceleration and WebAssembly fallback. Shared play/pause/seek still use the Android-compatible private `watch:<session-id>` protocol. Browser sync adds a busy-operation guard to the existing engine so a pending decoder seek cannot be mistaken for a frozen player. The Android source/protocol are unchanged. Includes clock compensation, bounded drift correction, reactions, local volume/mute, fullscreen, reconnect, saved position and ending for both. Backgrounding or peer disconnect pauses playback; periodic browser sync traffic stops without a peer and while hidden.

Both partners need the **same unprotected local movie file**. The movie is read lazily from disk and is never uploaded or transcoded on a server. The engine supports MP4, MKV and other libmedia containers, plus a broad decoder set including H.264/HEVC, VP8/VP9/AV1, AAC/AC-3/E-AC-3/DTS/MP3/Opus. Embedded text and ASS subtitle rendering is supplied by the engine. Streaming-service DRM downloads cannot be used. Performance and codec coverage remain bounded by the engine and device; this is not a guarantee of every VLC plugin or every media file. Rechoose the local file after page refresh; saved position remains available.

Use two devices for real watching: backgrounding a tab intentionally pauses the session. Each browser must click **Enable playback on this browser** once, then either partner can choose **Play together** when both are ready.

Fullscreen uses the entire display, preserves the movie aspect ratio, and overlays the controls. Controls hide after inactivity during playback; pointer/touch/keyboard input brings them back. Pausing or opening settings keeps the controls visible. Exit with Escape or the Exit fullscreen button.

**Embedded audio and captions:** open **Audio & captions · this device** after enabling playback. The selectors now read tracks from the file demuxer, independent of browser `audioTracks`/`textTracks` availability. Captions have an Off choice. Track changes are serialized with decoder operations and preserve local position; subtitle changes flush stale cues from the previous stream. An Off visibility gate persists through seeks and resume even if the upstream renderer restarts its cue loop. No language, caption, volume or subtitle content is broadcast. No separate file picker is provided.

**Seeking:** dragging previews the requested time without a playback update resetting the slider. Release commits one shared seek. Held keyboard adjustments commit on key release. Rapid seek requests coalesce to the last target, while decoder operations run one at a time. Use **Go to time**, or the 10-second skip buttons, for precise jumps. Decoder waiting/seeking/track-switch callbacks do not generate shared pause/resume commands. A genuinely frozen player still pauses with a recovery message rather than repeatedly auto-resuming.

**Smooth playback:** movie playback prioritizes uninterrupted frames over frame-exact partner timing. Local files use an 8-second encoded-packet buffer through a seekable disk adapter; duration probes keep the direct-file path. This matters because the pinned engine bypasses `preLoadTime` for direct `File` playback. Compatible video with matching AAC audio tracks uses the browser's native MSE playback pipeline. Files with AC-3, DTS, mixed audio formats or differing AAC configurations retain the worker/WebCodecs/WASM decoder so alternate languages remain usable. That path has a larger audio-worklet buffer (40 blocks rather than the desktop default of 10). Files remain local and are read in chunks.

Automatic sync ignores drift up to 0.75 seconds and uses at most a 1% speed adjustment beyond that, with hysteresis to avoid speed oscillation. Corrections are sampled once per second. An automatic seek requires more than 4 seconds of drift persisting for 8 seconds, then has a 15-second cooldown. Seeks and decoder work get a 5-second settling window. Short stalls get up to 10 seconds before a shared recovery pause. Explicit play, pause and seek controls still apply immediately. Partner timings can therefore differ slightly while both movies play smoothly. Android uses its existing sync policy; this tuning is browser-only.

Regression checks: `npm test` covers ten simulated minutes of jitter, persistent-drift recovery/cooldown, short stalls, stale heartbeats during decoder work, buffer adapter reads/seeks, and native-versus-fallback audio selection. Browser QA also exercises paired 1080p H.264/AAC MP4 playback, embedded captions/local language selection, and H.264/AC-3 MKV fallback. Retest your actual movie on both target laptops after redeploying; CPU/GPU capabilities and codec complexity still affect decoding speed. No schema, Edge Function, dependency or Render configuration changes are needed for this update.

## Backend and hosting

**SQL to run:** no new SQL. The existing app migrations must already be deployed, including chat/E2EE schema (`001`, `100`, `200`, `300`, `330`, `340`) and `src/features/movie/setup.sql` for private watch broadcasts. Do not duplicate or replace existing policies. Follow the Android backend's established migration order if provisioning a new project.

**Edge Functions to deploy:** none new. The existing `notify-partner` function supplies Android partner notifications.

The browser adapter in `src/backend.ts` mirrors the existing Supabase configuration and uses the same tables and RLS. It cannot import Android's `src/lib/supabase.ts` at runtime because that module initializes native AsyncStorage. Movie packet types and crypto source are read at build time. `src/watch-sync.ts` preserves the shared packet contract while adding a browser-only busy-operation guard. No Android file was modified.

For static hosting:

```powershell
npm run typecheck
npm run test
npm run build
```

Deploy only `web/dist/` to an HTTPS static host, with `index.html` as the index document. Navigation uses URL hashes, so no route rewrites are required. No server runtime, secret environment variables or CDN imports are needed after the build. The included HTTP server is loopback development tooling. This task does not create a hosted deployment.

**Render update required:** keep Root Directory blank and Publish Directory `web/dist`. Use this Build Command:

```sh
npm ci --include=dev --ignore-scripts && npm ci --prefix web --ignore-scripts && npm --prefix web run typecheck && npm --prefix web run build
```

Set `SKIP_INSTALL_DEPS=true`, keep the two public Supabase variables, and add response headers for `/*`: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. These enable the engine's threaded path; the engine also has a non-isolated worker-proxy fallback. `web/render.yaml` records the equivalent optional Blueprint. All worker/chunk/WASM assets are emitted to `dist/vendor/libmedia`; deploy them together. No CDN requests are needed while watching. Engine licensing/source details are in `THIRD_PARTY.md` and the served LGPL notice.

## Verification

```powershell
npm run typecheck
npm run test
node scripts/check-backend.mjs
```

Tests resolve every built module locally, check absence of native imports/test backend in production, verify sender/recipient encryption and context rejection/recovery compatibility, and run the Android engine's deterministic transport suite (clock skew, conflicting controls, drift, buffering, frozen decoder, background, disconnect, recovery and end).

For repeatable browser QA with fake accounts and no live writes:

```powershell
$env:PORT = '4174'
node scripts/serve.mjs --qa
```

Open `/qa.html?user=host#chat` and `/qa.html?user=guest#chat`. This opt-in fixture uses localStorage and BroadcastChannel, with both tabs simulated as foreground devices. It never connects to Supabase, sends push notifications or appears in production output. Use a small test MP4 in both tabs to exercise video playback. Production `/` continues to use the real backend even when the QA server is running.

Verified during implementation: production login and isolated chat; MP4/H.264/AAC and MKV/H.264/AC-3 playback; demuxed English/Hindi audio and English/French subtitle streams; French subtitle text actually rendering while the partner keeps captions Off; rapid shared 1:20 → 0:20 seeks while playing; playback continuing through the remainder of the two-minute fixture; partner pause/seek; fullscreen geometry/hiding/exit; reactions and session end. The browser tests use a local transport, not authenticated production Supabase Realtime between physical devices. Nine automated tests cover import/assets packaging, crypto compatibility, the Android sync suite, asynchronous seek coalescing, transport intent, caption flushing and slow-seek guards.

Root `npx tsc --noEmit` passed. One Expo Doctor run passed 19/21 checks; existing warnings cover untested New Architecture call libraries and 11 Expo patch-version mismatches. These shared dependencies were not modified.

## Device verification / regression checklist

- Sign into each actual partner account; verify pairing and cross-couple RLS isolation.
- Send text Android → browser and browser → Android. Verify seen receipts, earlier history, offline retry and local sign-out.
- Restore encrypted chat with the recovery passphrase, compare safety number, send in both directions, lock the browser tab and confirm messages are hidden. Check changed keys block sending until verification.
- Create a movie on Android and join on web, then reverse. Wrong-size/duration files must be rejected.
- Enable playback in each browser; confirm both-ready gate, play, pause, seek, reactions, buffering, reconnect and ending on actual networks.
- Background either device: both pause. Return and explicitly resume. Confirm saved-position return after reselecting the same file.
- Test your actual movie's codecs and long playback with headphones. Browser autoplay policies and Android media/audio focus require device checks.
- Verify HTTPS deployment, public configuration, keyboard navigation, small-screen layouts and the available theme palettes.
- Verify fullscreen uses the entire viewport with no fixed `65dvh` limit, controls overlay/hide while playing, Escape exits, and reopening preserves the same movie/time.
- With an embedded multitrack MP4/MKV, choose different audio/subtitle languages on each device, turn captions Off independently, seek both directions during playback, and confirm the choices persist and shared time converges.

**Not verified:** real account sign-in, authenticated production queries, production Realtime/notification delivery, Android-to-browser playback on devices, and a hosted deployment. No user credentials were available and no native build was run.

**Needs shared change:** none. The requested media engine dependency and lockfile live only in `web/`, explicitly authorized for this task. Update the Render build command/headers above. Existing Expo Doctor warnings remain for a dedicated Android dependency session. No migration or new Edge Function is required.

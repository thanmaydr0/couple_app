# Us web

Separate browser frontend for the existing Android app. Includes admin-created account login, a couple dashboard, live text chat and local movie watching. No calls. Android source, native projects, root manifests and backend schema are unchanged.

## Run locally

From `C:\5thsem\Projects\couple_app\web`:

```powershell
npm start
```

Open http://127.0.0.1:4173. `start` builds first. After editing source, restart the server or run `npm run build`, then reload your browser. No hot reload or dependency installation is required. Uses the existing repository's installed TypeScript, Supabase and crypto packages; this folder is a separate frontend, not a separately installed dependency tree.

The build reads only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the root `.env`, then `web/.env`, then the process environment. Override with `web/.env` using `.env.example` if needed. Only these public values enter `dist/config.js`. Secret/service-role keys are rejected. Never put admin credentials or a Metered key here.

## Features and boundaries

- **Login:** existing email/password accounts; persistent browser session; local sign-out; pairing gate with retry. No signup or reset flow is invented.
- **Dashboard:** actual partner name, anniversary when configured, chat and movie entry points, four existing theme palettes. No fabricated online status or sample content.
- **Chat:** text sends, stable client IDs for retry after ambiguous failures, live insert/update/delete events, 50-message history pages, seen receipts for readable text in a focused tab, in-memory failed sends, partner notification rate limiting. Plaintext photos and voice messages are viewable. Deleted, expired and view-once content is protected. History and drafts are not persisted to browser storage.
- **Encrypted chat:** uses the Android encryption protocol directly. Restore your existing recovery backup with its passphrase and compare the displayed safety number with your partner's Android Privacy screen before sending. No new keys are registered or encryption settings changed. Private keys live only in tab memory and clear when leaving Chat, locking or signing out. Encrypted attachments and view-once media must be opened in Android. Browser text chat works with encryption on or off.
- **Watch:** uses Android's `WatchSync` class and private `watch:<session-id>` channel directly. Create/join invitations from either platform, validate file size and duration, enable local playback, then control play/pause/seek together. Includes clock compensation, drift correction, buffering pauses, reactions, local volume, fullscreen, reconnect, saved position and ending for both. Playback pauses when a browser tab backgrounds or the peer disconnects. Periodic browser sync traffic stops without a peer and while hidden.

Both partners need the **same unprotected local movie file**. The video is never uploaded. MP4 with H.264 video and AAC audio is the recommended common format. Browsers cannot play Netflix/DRM downloads or every codec that Android supports. A browser must choose its local copy again after a page refresh; browsers do not grant persistent file access by default. The saved position remains available.

Use two devices for real watching: backgrounding a tab intentionally pauses the session. Each browser must click **Enable playback on this browser** once, then either partner can choose **Play together** when both are ready.

Fullscreen uses the entire display, preserves the movie aspect ratio, and overlays the controls. Controls hide after inactivity during playback; pointer/touch/keyboard input brings them back. Pausing or opening settings keeps the controls visible. Exit with Escape or the Exit fullscreen button.

**Embedded audio and captions:** open **Audio & captions · this device**. The selectors list audio languages and subtitle/caption tracks exposed by your browser for the selected video. Captions include an Off choice. These controls change only the local video element; they do not send sync messages or change the partner's preferences. No separate audio/caption file picker is provided.

**Current limitation:** embedded track exposure varies by browser and container/codec. A generated MP4 with two AAC audio languages and a `mov_text` subtitle stream decoded in the tested Chromium browser, but its embedded tracks were not exposed for selection. The UI reports this rather than claiming the file has no tracks. The native browser player therefore does **not** yet provide VLC-equivalent embedded-track switching for all movies. Supporting that requires a separate demuxing/decoding playback engine and a dedicated dependency/integration task; no package was installed under the standing no-dependency rule. See [audio track availability](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/audioTracks).

## Backend and hosting

**SQL to run:** no new SQL. The existing app migrations must already be deployed, including chat/E2EE schema (`001`, `100`, `200`, `300`, `330`, `340`) and `src/features/movie/setup.sql` for private watch broadcasts. Do not duplicate or replace existing policies. Follow the Android backend's established migration order if provisioning a new project.

**Edge Functions to deploy:** none new. The existing `notify-partner` function supplies Android partner notifications.

The browser adapter in `src/backend.ts` mirrors the existing Supabase configuration and uses the same tables and RLS. It cannot import Android's `src/lib/supabase.ts` at runtime because that module initializes native AsyncStorage. Shared movie and crypto source are read directly at build time and compiled into this frontend, preventing protocol forks.

For static hosting:

```powershell
npm run typecheck
npm run test
npm run build
```

Deploy only `web/dist/` to an HTTPS static host, with `index.html` as the index document. Navigation uses URL hashes, so no route rewrites are required. No server runtime, secret environment variables or CDN imports are needed after the build. The included HTTP server is loopback development tooling. This task does not create a hosted deployment.

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

Verified during implementation: production login renders without browser errors; isolated two-account chat send/history; actual H.264/AAC video decoding; both-ready gating; play on both players; partner pause (positions within approximately 2 ms at the observed pause); partner seek; reaction delivery; session end on both clients. This verifies browser media plus the shared protocol with a local transport, not Supabase Realtime connectivity between physical devices.

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
- For a browser exposing embedded tracks, choose different audio/subtitle languages on each device, turn captions Off independently, and confirm play/pause/seek remain synchronized. For unsupported browsers, verify the explicit compatibility explanation.

**Not verified:** real account sign-in, authenticated production queries, production Realtime/notification delivery, Android-to-browser playback on devices, and a hosted deployment. No user credentials were available and no native build was run.

**Needs shared change:** a dedicated browser media-engine dependency/integration task is required for VLC-equivalent embedded audio/subtitle switching in browsers that do not expose the tracks. Native selectors are implemented, but this broader requirement is incomplete. Existing Expo Doctor warnings can be addressed in a dedicated dependency session. No migration or new Edge Function is required.

# Watch presentation handoff

Reference: local `SESSION_C_MIDNIGHT.png` and `SESSION_C_LANDSCAPE.png`, linked by `FIGMA_INDEX_C.md`. No Figma connection or generated code was used.

The lobby now uses the movie-night hero, shared Header, rounded session metadata cards and spring invitation entrances limited to the first screenful. Verification retains the original exact comparisons and override confirmation, with a thumbnail fallback, mismatch shake and explanation. The player has themed opaque controls, a 3.5-second hide timeout, fade/slide visibility, a visual thumb that scales over the unchanged native slider, skip pulses, status crossfades, floating reactions and waiting dots. Full/Reduced/Off follow `useMotion`; playback decoration uses transform/opacity on the animation thread. The verification tick draws only when the existing `matches` predicate passes.

## Deviations and limits

- The lobby immediately navigates after file selection and exposes only session metadata, not a local URI. Lobby cards therefore show name/bytes/duration without a thumbnail. Thumbnails are generated only for the existing verification candidate or player file. Lobby thumbnails need an approved file-flow change.
- The match tick appears with the accepted file in the player; there is no intermediate success screen or artificial delay before playback.
- Status text preserves the sync engine's “Partner is paused/seeking” wording. A named status such as “Neha paused” needs a separately approved name-data handoff.
- Portrait/landscape retain the existing orientation function and Modal lifecycle; the native modal fades (immediate in Off), rather than morphing or relocating the video surface. Native transition duration is platform controlled.
- The player is taller than the reference's video-only region to accommodate 48dp controls. The real video remains contained. The custom visual thumb follows the existing native slider values; exact track alignment needs Android device review.
- Existing lobby offline and session-list loading signals remain unavailable. No fabricated connection or loading state was added. Profile loading, file-reading, session restoration, errors, empty invites and player connection state use existing signals.
- New presentation helpers live only in `movie/presentation.tsx`; no shared component extraction or dependency change was made.

## Verification

`npx tsc --noEmit` initially passed after the restyle; the final run reports only errors in the concurrently edited calls/chess folders, with no movie or owned-route errors. The existing deterministic `verify.mjs` checks pass for metadata boundaries, drift thresholds, either controller, clock skew, simultaneous controls, stalls, reactions, background/return, reconnect, end and invalid payloads. Existing create/refresh/accept/choose/override/orientation function bodies were compared against Git and are unchanged. Sync, local file verification/storage, hooks, model types, routes and filenames were not edited.

Expo Doctor ran once without installation: 19/21 passed. Existing issues are New Architecture metadata for the two calling libraries and nine Expo patch-version mismatches. No native builds, installs or Expo exports were run.

## Required two-phone checks

Use the existing Android development build, two linked accounts, the same unprotected MP4 on both phones and a second different file. Follow `TESTING.md` and additionally check:

1. Create and join; invitation entrance; waiting state before the partner is ready.
2. Different-file mismatch, shake and exact metadata; cancel/confirm override; choose the matching copy.
3. Play/pause/native scrub/±10s from either phone; maintain sync for **10 minutes**.
4. Lock/unlock one phone mid-movie; both pause and recover using existing readiness rules.
5. Every emoji from either phone, including Full, Reduced and Off animation preferences.
6. Landscape fullscreen and Android Back; restored orientation and no duplicated playback.
7. 3.5-second controls hide, drag keeps controls visible, thumb alignment at both endpoints, large text and 48dp targets.
8. Thumbnail generation with Android content URIs, unavailable-preview fallback, errors and reconnect.

Native rendering, accessibility contrast over actual video, codec/URI behavior, thumbnail cost, audio focus, measured drift and rotation have not been verified without devices.

## Needs shared change

No shared files are required for the delivered restyle. Coordinate separately for lobby offline/loading signals, lobby URI access, partner display-name plumbing and Expo dependency maintenance. Reusable presentation candidates remain feature local as required.

# Calls presentation restyle

## Built
- Matched local `qa-C-Calls-Incoming.png` and `qa-C-Calls-Video.png` using semantic theme tokens and shared Screen/Header/Avatar; no Figma MCP.
- Incoming waves, accept pulse, static/reduced gradient and Full-only drift; outgoing dots and smaller rings; audio idle pulse.
- Video chrome fades/slides after four seconds and returns on background tap. Screen readers keep controls visible; reconnect/error also keeps controls available.
- Self-view drags and springs to the nearest reserved corner; flip icon rotates; changed mute/camera glyphs fade in.
- History enters with a first-screenful stagger, missed status uses danger ink, and callback rows use PressableScale/haptics.
- Engine, notification logic, permissions, stores, queries, types, routes and media remain unchanged.

## Verified
- `npx tsc --noEmit`: no errors in calls. The run reported an unrelated `src/features/chess/Board.tsx:49` error during the concurrent games session.
- `node --test src/features/calls/engine.test.cjs`: 12/12 passed.
- `npx --no-install expo-doctor` once: 19/21 passed. Existing New Architecture metadata warnings for react-native-webrtc/react-native-incall-manager and nine Expo patch-version mismatches remain.
- `git diff --check`: passed for owned paths. Call text/control foreground-background token pairs pass 4.5:1 in all theme palettes.
- No installs, native builds, exports or shared-file edits.

## Device-only / manual checklist
Use two Android phones, ideally on different networks:
1. Voice and video connect; mute, speaker/output routing, camera toggle/flip and end work.
2. Missed calls log; incoming UI appears with the app open; call push opens the app.
3. Check four-second control hide/tap return, reconnect banner, preview drag/snap, haptics and Full/Reduced/Off motion (including Android Reduce motion).
4. Check safe areas, long names, enlarged text, small screens and landscape. Real video layering, native media performance and accessibility need device validation.

## Deviations / needs shared change
- Local PNGs replace Figma fetch, as explicitly requested. Colors/fonts come from current app tokens, so exact PNG pixels are not copied.
- Audio has an idle pulse: the existing state exposes no audio level. No audio-to-video action was invented.
- Icons fade between existing glyphs rather than morphing vector paths; camera flip rotates its control icon.
- Call-ended transition deferred: CallProvider immediately hides the modal at idle and the engine has no ended presentation phase. A coordinated lifecycle change is required; no timing delay was added.
- Dedicated offline UI requires an existing reliable signal; readiness/error/reconnecting states are preserved rather than inventing connectivity state.
- Feature-local reusable presentation helpers live in `src/features/calls/presentation.tsx`; shared-owner extraction is optional. Dependency maintenance belongs to the shared owner.

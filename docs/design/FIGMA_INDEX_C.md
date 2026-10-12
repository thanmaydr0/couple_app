# Session C — local design index

Continued from the supplied **Us — Warm Glow.png** reference at the user’s request. Figma MCP is no longer part of this workflow. No Figma nodes were created or edited; all links below identify local editable HTML frames, not Figma node IDs.

## Open the design

- [Editable board — 108 frames](./SESSION_C.html)
- [Midnight review sheet — 12 representative screens](./SESSION_C_MIDNIGHT.png)
- [Rose review sheet](./SESSION_C_ROSE.png)
- [Noir review sheet](./SESSION_C_NOIR.png)
- [Full-size landscape player — 915 × 412](./SESSION_C_LANDSCAPE.png)
- [Machine-readable QA results](./SESSION_C_QA.json)
- [Reproducible browser checks](./SESSION_C_VERIFY.cjs)
- [Detailed screen and motion brief](./FIGMA_BRIEF_C.md)

Open SESSION_C.html in a browser. Choose Midnight/Rose/Noir, an area, and Key screens or All states. Overview gives a contact sheet. Try a flow enters the local prototype; Previous/Next frame steps through its states. Every frame has adjacent motion notes and implementation gaps. Fonts and theme values are embedded, so the board works offline.

## Verification

Browser QA rendered all 108 uniquely named 412 × 915 frames in each of Midnight, Rose and Noir. No script errors, external requests, incorrect dimensions or horizontal content overflow were observed. Computed CSS text foreground/background pairs passed the 4.5:1 check; gradient text was checked against both endpoints. Browser reflow stress at enlarged type reported no horizontal content overflow. These checks do not measure emoji pixels, composite video footage, Android accessibility font scaling, or native safe areas.

Visually inspected the representative theme sheets and individual chess/drawing/call compositions. The Watch picker flow, correct Scribble guess, incoming-video acceptance, keyboard movement of self-view and offline action gates passed local interaction checks. Chess check and winning positions were validated using the already installed chess.js package. Shared app files, dependencies, hooks, stores and routes were untouched.

`npx tsc --noEmit` passed on this run. Expo Doctor ran once with `npx --no-install expo-doctor`: 19/21 checks passed; New Architecture metadata for two calling packages and nine Expo patch-version mismatches remain outside this design task. No dependencies were installed or changed.

## Device-only and implementation limits

- Real local playback, sync/readiness, Android picker/rotation, keyboard insets, drawing sync, chess interaction and call permissions/routing/media still require app/device validation.
- Video and avatar photography were not supplied; clearly labeled content placeholders/initials are used.
- Audio-to-video upgrade is absent from current source and was not invented. Call-ended presentation, corner snap and control hide are requested presentation refinements with source gaps noted beside their frames.
- Initial loading and explicit offline signals missing from source are labeled handoff requirements. Native Android dialogs/pickers are represented by preparation states, not fabricated system UI.
- This board reuses local rendering functions and CSS semantic variables; it cannot instantiate the Figma Components page or create Figma Smart Animate connections from a PNG.

## Frame links

| Frame | Local anchor |
|---|---|
| Watch/Lobby/default | [Open frame](./SESSION_C.html?frame=Watch%2FLobby%2Fdefault) · `watch-lobby-default` |
| Watch/Lobby/invited | [Open frame](./SESSION_C.html?frame=Watch%2FLobby%2Finvited) · `watch-lobby-invited` |
| Watch/Lobby/resume | [Open frame](./SESSION_C.html?frame=Watch%2FLobby%2Fresume) · `watch-lobby-resume` |
| Watch/Lobby/loading | [Open frame](./SESSION_C.html?frame=Watch%2FLobby%2Floading) · `watch-lobby-loading` |
| Watch/Lobby/empty | [Open frame](./SESSION_C.html?frame=Watch%2FLobby%2Fempty) · `watch-lobby-empty` |
| Watch/Lobby/error | [Open frame](./SESSION_C.html?frame=Watch%2FLobby%2Ferror) · `watch-lobby-error` |
| Watch/Lobby/offline | [Open frame](./SESSION_C.html?frame=Watch%2FLobby%2Foffline) · `watch-lobby-offline` |
| Watch/File picker/default | [Open frame](./SESSION_C.html?frame=Watch%2FFile%20picker%2Fdefault) · `watch-file-picker-default` |
| Watch/File picker/reading | [Open frame](./SESSION_C.html?frame=Watch%2FFile%20picker%2Freading) · `watch-file-picker-reading` |
| Watch/File picker/error | [Open frame](./SESSION_C.html?frame=Watch%2FFile%20picker%2Ferror) · `watch-file-picker-error` |
| Watch/Verification/default | [Open frame](./SESSION_C.html?frame=Watch%2FVerification%2Fdefault) · `watch-verification-default` |
| Watch/Verification/match | [Open frame](./SESSION_C.html?frame=Watch%2FVerification%2Fmatch) · `watch-verification-match` |
| Watch/Verification/mismatch | [Open frame](./SESSION_C.html?frame=Watch%2FVerification%2Fmismatch) · `watch-verification-mismatch` |
| Watch/Verification/override | [Open frame](./SESSION_C.html?frame=Watch%2FVerification%2Foverride) · `watch-verification-override` |
| Watch/Verification/ended | [Open frame](./SESSION_C.html?frame=Watch%2FVerification%2Fended) · `watch-verification-ended` |
| Watch/Verification/loading | [Open frame](./SESSION_C.html?frame=Watch%2FVerification%2Floading) · `watch-verification-loading` |
| Watch/Verification/error | [Open frame](./SESSION_C.html?frame=Watch%2FVerification%2Ferror) · `watch-verification-error` |
| Watch/Verification/offline | [Open frame](./SESSION_C.html?frame=Watch%2FVerification%2Foffline) · `watch-verification-offline` |
| Watch/Player portrait/both ready | [Open frame](./SESSION_C.html?frame=Watch%2FPlayer%20portrait%2Fboth%20ready) · `watch-player-portrait-both-ready` |
| Watch/Player portrait/playing | [Open frame](./SESSION_C.html?frame=Watch%2FPlayer%20portrait%2Fplaying) · `watch-player-portrait-playing` |
| Watch/Player portrait/controls hidden | [Open frame](./SESSION_C.html?frame=Watch%2FPlayer%20portrait%2Fcontrols%20hidden) · `watch-player-portrait-controls-hidden` |
| Watch/Player portrait/waiting | [Open frame](./SESSION_C.html?frame=Watch%2FPlayer%20portrait%2Fwaiting) · `watch-player-portrait-waiting` |
| Watch/Player portrait/buffering | [Open frame](./SESSION_C.html?frame=Watch%2FPlayer%20portrait%2Fbuffering) · `watch-player-portrait-buffering` |
| Watch/Player portrait/offline | [Open frame](./SESSION_C.html?frame=Watch%2FPlayer%20portrait%2Foffline) · `watch-player-portrait-offline` |
| Watch/Player portrait/error | [Open frame](./SESSION_C.html?frame=Watch%2FPlayer%20portrait%2Ferror) · `watch-player-portrait-error` |
| Watch/Player landscape/both ready | [Open frame](./SESSION_C.html?frame=Watch%2FPlayer%20landscape%2Fboth%20ready) · `watch-player-landscape-both-ready` |
| Watch/Player landscape/playing | [Open frame](./SESSION_C.html?frame=Watch%2FPlayer%20landscape%2Fplaying) · `watch-player-landscape-playing` |
| Watch/Player landscape/waiting | [Open frame](./SESSION_C.html?frame=Watch%2FPlayer%20landscape%2Fwaiting) · `watch-player-landscape-waiting` |
| Watch/Player landscape/offline | [Open frame](./SESSION_C.html?frame=Watch%2FPlayer%20landscape%2Foffline) · `watch-player-landscape-offline` |
| Games/Hub/default | [Open frame](./SESSION_C.html?frame=Games%2FHub%2Fdefault) · `games-hub-default` |
| Chess/Lobby/default | [Open frame](./SESSION_C.html?frame=Chess%2FLobby%2Fdefault) · `chess-lobby-default` |
| Chess/Lobby/resume | [Open frame](./SESSION_C.html?frame=Chess%2FLobby%2Fresume) · `chess-lobby-resume` |
| Chess/Lobby/loading | [Open frame](./SESSION_C.html?frame=Chess%2FLobby%2Floading) · `chess-lobby-loading` |
| Chess/Lobby/empty | [Open frame](./SESSION_C.html?frame=Chess%2FLobby%2Fempty) · `chess-lobby-empty` |
| Chess/Lobby/error | [Open frame](./SESSION_C.html?frame=Chess%2FLobby%2Ferror) · `chess-lobby-error` |
| Chess/Lobby/offline | [Open frame](./SESSION_C.html?frame=Chess%2FLobby%2Foffline) · `chess-lobby-offline` |
| Chess/Board/my turn | [Open frame](./SESSION_C.html?frame=Chess%2FBoard%2Fmy%20turn) · `chess-board-my-turn` |
| Chess/Board/partner turn | [Open frame](./SESSION_C.html?frame=Chess%2FBoard%2Fpartner%20turn) · `chess-board-partner-turn` |
| Chess/Board/check | [Open frame](./SESSION_C.html?frame=Chess%2FBoard%2Fcheck) · `chess-board-check` |
| Chess/Board/saving | [Open frame](./SESSION_C.html?frame=Chess%2FBoard%2Fsaving) · `chess-board-saving` |
| Chess/Board/no moves | [Open frame](./SESSION_C.html?frame=Chess%2FBoard%2Fno%20moves) · `chess-board-no-moves` |
| Chess/Board/offline | [Open frame](./SESSION_C.html?frame=Chess%2FBoard%2Foffline) · `chess-board-offline` |
| Chess/Board/error | [Open frame](./SESSION_C.html?frame=Chess%2FBoard%2Ferror) · `chess-board-error` |
| Chess/Promotion/default | [Open frame](./SESSION_C.html?frame=Chess%2FPromotion%2Fdefault) · `chess-promotion-default` |
| Chess/Offer draw/received | [Open frame](./SESSION_C.html?frame=Chess%2FOffer%20draw%2Freceived) · `chess-offer-draw-received` |
| Chess/Offer draw/sent | [Open frame](./SESSION_C.html?frame=Chess%2FOffer%20draw%2Fsent) · `chess-offer-draw-sent` |
| Chess/Resign/default | [Open frame](./SESSION_C.html?frame=Chess%2FResign%2Fdefault) · `chess-resign-default` |
| Chess/Game over/win | [Open frame](./SESSION_C.html?frame=Chess%2FGame%20over%2Fwin) · `chess-game-over-win` |
| Chess/Game over/lose | [Open frame](./SESSION_C.html?frame=Chess%2FGame%20over%2Flose) · `chess-game-over-lose` |
| Chess/Game over/draw | [Open frame](./SESSION_C.html?frame=Chess%2FGame%20over%2Fdraw) · `chess-game-over-draw` |
| Scribble/Lobby/default | [Open frame](./SESSION_C.html?frame=Scribble%2FLobby%2Fdefault) · `scribble-lobby-default` |
| Scribble/Lobby/loading | [Open frame](./SESSION_C.html?frame=Scribble%2FLobby%2Floading) · `scribble-lobby-loading` |
| Scribble/Lobby/empty | [Open frame](./SESSION_C.html?frame=Scribble%2FLobby%2Fempty) · `scribble-lobby-empty` |
| Scribble/Lobby/error | [Open frame](./SESSION_C.html?frame=Scribble%2FLobby%2Ferror) · `scribble-lobby-error` |
| Scribble/Lobby/offline | [Open frame](./SESSION_C.html?frame=Scribble%2FLobby%2Foffline) · `scribble-lobby-offline` |
| Scribble/Word pick/default | [Open frame](./SESSION_C.html?frame=Scribble%2FWord%20pick%2Fdefault) · `scribble-word-pick-default` |
| Scribble/Word pick/waiting | [Open frame](./SESSION_C.html?frame=Scribble%2FWord%20pick%2Fwaiting) · `scribble-word-pick-waiting` |
| Scribble/Word pick/error | [Open frame](./SESSION_C.html?frame=Scribble%2FWord%20pick%2Ferror) · `scribble-word-pick-error` |
| Scribble/Word pick/offline | [Open frame](./SESSION_C.html?frame=Scribble%2FWord%20pick%2Foffline) · `scribble-word-pick-offline` |
| Scribble/Word pick/loading | [Open frame](./SESSION_C.html?frame=Scribble%2FWord%20pick%2Floading) · `scribble-word-pick-loading` |
| Scribble/Draw/default | [Open frame](./SESSION_C.html?frame=Scribble%2FDraw%2Fdefault) · `scribble-draw-default` |
| Scribble/Draw/urgent | [Open frame](./SESSION_C.html?frame=Scribble%2FDraw%2Furgent) · `scribble-draw-urgent` |
| Scribble/Draw/loading | [Open frame](./SESSION_C.html?frame=Scribble%2FDraw%2Floading) · `scribble-draw-loading` |
| Scribble/Draw/empty | [Open frame](./SESSION_C.html?frame=Scribble%2FDraw%2Fempty) · `scribble-draw-empty` |
| Scribble/Draw/error | [Open frame](./SESSION_C.html?frame=Scribble%2FDraw%2Ferror) · `scribble-draw-error` |
| Scribble/Draw/offline | [Open frame](./SESSION_C.html?frame=Scribble%2FDraw%2Foffline) · `scribble-draw-offline` |
| Scribble/Draw/clear | [Open frame](./SESSION_C.html?frame=Scribble%2FDraw%2Fclear) · `scribble-draw-clear` |
| Scribble/Guess/default | [Open frame](./SESSION_C.html?frame=Scribble%2FGuess%2Fdefault) · `scribble-guess-default` |
| Scribble/Guess/empty | [Open frame](./SESSION_C.html?frame=Scribble%2FGuess%2Fempty) · `scribble-guess-empty` |
| Scribble/Guess/close | [Open frame](./SESSION_C.html?frame=Scribble%2FGuess%2Fclose) · `scribble-guess-close` |
| Scribble/Guess/correct | [Open frame](./SESSION_C.html?frame=Scribble%2FGuess%2Fcorrect) · `scribble-guess-correct` |
| Scribble/Guess/error | [Open frame](./SESSION_C.html?frame=Scribble%2FGuess%2Ferror) · `scribble-guess-error` |
| Scribble/Guess/offline | [Open frame](./SESSION_C.html?frame=Scribble%2FGuess%2Foffline) · `scribble-guess-offline` |
| Scribble/Guess/loading | [Open frame](./SESSION_C.html?frame=Scribble%2FGuess%2Floading) · `scribble-guess-loading` |
| Scribble/Round summary/solved | [Open frame](./SESSION_C.html?frame=Scribble%2FRound%20summary%2Fsolved) · `scribble-round-summary-solved` |
| Scribble/Round summary/time up | [Open frame](./SESSION_C.html?frame=Scribble%2FRound%20summary%2Ftime%20up) · `scribble-round-summary-time-up` |
| Scribble/Round summary/error | [Open frame](./SESSION_C.html?frame=Scribble%2FRound%20summary%2Ferror) · `scribble-round-summary-error` |
| Scribble/Round summary/offline | [Open frame](./SESSION_C.html?frame=Scribble%2FRound%20summary%2Foffline) · `scribble-round-summary-offline` |
| Scribble/Results/win | [Open frame](./SESSION_C.html?frame=Scribble%2FResults%2Fwin) · `scribble-results-win` |
| Scribble/Results/lose | [Open frame](./SESSION_C.html?frame=Scribble%2FResults%2Flose) · `scribble-results-lose` |
| Scribble/Results/tie | [Open frame](./SESSION_C.html?frame=Scribble%2FResults%2Ftie) · `scribble-results-tie` |
| Scribble/Results/error | [Open frame](./SESSION_C.html?frame=Scribble%2FResults%2Ferror) · `scribble-results-error` |
| Scribble/Results/offline | [Open frame](./SESSION_C.html?frame=Scribble%2FResults%2Foffline) · `scribble-results-offline` |
| Calls/Incoming/audio | [Open frame](./SESSION_C.html?frame=Calls%2FIncoming%2Faudio) · `calls-incoming-audio` |
| Calls/Incoming/video | [Open frame](./SESSION_C.html?frame=Calls%2FIncoming%2Fvideo) · `calls-incoming-video` |
| Calls/Incoming/avatar fallback | [Open frame](./SESSION_C.html?frame=Calls%2FIncoming%2Favatar%20fallback) · `calls-incoming-avatar-fallback` |
| Calls/Incoming/error | [Open frame](./SESSION_C.html?frame=Calls%2FIncoming%2Ferror) · `calls-incoming-error` |
| Calls/Calling/preparing | [Open frame](./SESSION_C.html?frame=Calls%2FCalling%2Fpreparing) · `calls-calling-preparing` |
| Calls/Calling/outgoing | [Open frame](./SESSION_C.html?frame=Calls%2FCalling%2Foutgoing) · `calls-calling-outgoing` |
| Calls/Calling/connecting | [Open frame](./SESSION_C.html?frame=Calls%2FCalling%2Fconnecting) · `calls-calling-connecting` |
| Calls/Calling/error | [Open frame](./SESSION_C.html?frame=Calls%2FCalling%2Ferror) · `calls-calling-error` |
| Calls/Audio/default | [Open frame](./SESSION_C.html?frame=Calls%2FAudio%2Fdefault) · `calls-audio-default` |
| Calls/Audio/muted | [Open frame](./SESSION_C.html?frame=Calls%2FAudio%2Fmuted) · `calls-audio-muted` |
| Calls/Audio/route chooser | [Open frame](./SESSION_C.html?frame=Calls%2FAudio%2Froute%20chooser) · `calls-audio-route-chooser` |
| Calls/Audio/error | [Open frame](./SESSION_C.html?frame=Calls%2FAudio%2Ferror) · `calls-audio-error` |
| Calls/Video/default | [Open frame](./SESSION_C.html?frame=Calls%2FVideo%2Fdefault) · `calls-video-default` |
| Calls/Video/controls hidden | [Open frame](./SESSION_C.html?frame=Calls%2FVideo%2Fcontrols%20hidden) · `calls-video-controls-hidden` |
| Calls/Video/camera off | [Open frame](./SESSION_C.html?frame=Calls%2FVideo%2Fcamera%20off) · `calls-video-camera-off` |
| Calls/Video/no remote | [Open frame](./SESSION_C.html?frame=Calls%2FVideo%2Fno%20remote) · `calls-video-no-remote` |
| Calls/Video/error | [Open frame](./SESSION_C.html?frame=Calls%2FVideo%2Ferror) · `calls-video-error` |
| Calls/Reconnecting/audio | [Open frame](./SESSION_C.html?frame=Calls%2FReconnecting%2Faudio) · `calls-reconnecting-audio` |
| Calls/Reconnecting/video | [Open frame](./SESSION_C.html?frame=Calls%2FReconnecting%2Fvideo) · `calls-reconnecting-video` |
| Calls/Ended/default | [Open frame](./SESSION_C.html?frame=Calls%2FEnded%2Fdefault) · `calls-ended-default` |
| Calls/Recent/default | [Open frame](./SESSION_C.html?frame=Calls%2FRecent%2Fdefault) · `calls-recent-default` |
| Calls/Recent/loading | [Open frame](./SESSION_C.html?frame=Calls%2FRecent%2Floading) · `calls-recent-loading` |
| Calls/Recent/empty | [Open frame](./SESSION_C.html?frame=Calls%2FRecent%2Fempty) · `calls-recent-empty` |
| Calls/Recent/error | [Open frame](./SESSION_C.html?frame=Calls%2FRecent%2Ferror) · `calls-recent-error` |
| Calls/Recent/offline | [Open frame](./SESSION_C.html?frame=Calls%2FRecent%2Foffline) · `calls-recent-offline` |

## Git scope

Only this index is authorized for the commit. The editable board, screenshots, catalog, QA helper/results and brief remain local and uncommitted; copy them with the index when sharing this handoff. Commit signing previously failed because the SSH signing key needed its passphrase. No signing configuration was changed.

## Needs shared change

No shared app change was made in this design session. Later implementation must use the shared useTheme/useMotion/PressableScale/Screen/Header interfaces under the updated UI rules. Missing loading/offline signals and call refinements must be coordinated before feature sessions change logic; fonts/theme persistence and shared interaction support belong to the shared owner.

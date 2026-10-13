# Game night

Four Android couple games use one server-owned engine and one screen, reached through the existing `/us/gamenight` registry route. No shared files, dependencies, native folders, or Games tab changes are required.

## Built

- Know Me: 200 original multiple-choice questions (50 each in favorites, memories, habits, dreams); custom four-choice or typed questions; ten rounds alternating subject/guesser; scores, streaks, best streak and lifetime knowing percentage.
- Would You Rather: 150 original pairs, custom pairs, ten simultaneous private choices, split reveal and lifetime agreement percentage. There is no artificial winner in this cooperative game.
- Truth or Dare: 104 original PG-13 prompts (26 per mood), custom entries, Skia wheel driven by the motion kit's spring physics, throttled tick haptics, two skip tokens per player, eight alternating turns, check-offs and an always-available end action.
- Connect Four: server-validated gravity, four-direction wins and full-board draws, turn ownership, immutable moves, falling discs, labeled discs and outlined win line, rematches.
- Per-game lobbies, AnimatedNumber tallies, recent results, invitations, resume, loading/error/empty/offline states, theme tokens, shared Screen/Header/Button (PressableScale), and Full/Reduced/Off motion. Column targets remain at least 48dp with horizontal scrolling on narrow displays.

## Engine and privacy

`game_rounds` contains public state; `game_stats` contains persistent tallies. A couple/game has at most one unfinished match. Participants are captured at creation; stable sorted UUIDs identify A/B. Writes use `gamenight_action`, an invoker wrapper around an authenticated, couple-checked private-schema state machine. Row locks serialize actions and a step number rejects stale requests. An advisory lock makes simultaneous starts converge on one invitation. Direct client writes to rounds, choices and stats are revoked.

`gamenight_choices` contains one immutable row per author/step. RLS permits the author to read it; the partner can read both only after the second committed answer changes the public reveal flag. No secret answer enters public state, notification payloads, or client broadcasts. Finishing and stats updates occur in the same transaction. Previous-round choices cease being partner-readable after advancing.

Typed answers use Fuse.js for revealed-answer similarity feedback. The server separately normalizes case, whitespace and Unicode and uses bounded edit distance (20%, minimum four characters) for authoritative scoring, so a modified client cannot forge a fuzzy-match score. Fuse and edit-distance hints may differ for some strings; the displayed score always comes from the server.

Realtime uses the existing `useRealtimeTable` for rounds, stats and custom prompts. Active games and current-step choices have narrow additional reads so bounded history never prevents resume. Round revisions refetch choices after RLS visibility changes. Shared subscriptions stop on background; no high-frequency broadcast is used. Wheel animation and haptics stop on background.

Custom prompts are couple-scoped, validated on both client/server, shared, and deletable only by their author. The lobby can select custom prompts only. One custom prompt can be reused if it is the entire deck.

Turn notifications call the existing `notify-partner` function on `pulse`, with `/us/gamenight` and game/round metadata. A persisted 60-second cooldown per sender/couple prevents restart spam. Notification failure does not roll back gameplay. The existing notification router opens the Game night hub; the individual game is selected there.

## Deployment completed

Applied the final, rerunnable `supabase/migrations/160_gamenight.sql` to the repo-configured project `tlqedvktbgaipzhdgsuy`. It creates four tables, indexes, RLS/grants, the engine and private helpers, and publication entries. It needs the existing base couples/profiles schema and `my_couple_id()` first; these were already present. No existing columns were changed.

No new Edge Functions or scheduler handlers are necessary. Confirmed the deployed `notify-partner` is ACTIVE and supports `pulse` and this route. Do not deploy or modify shared Edge Functions for this feature.

The Games registry already imports this feature's config; `enabled: true` makes its existing entry available. No manual setup is outstanding for the connected project.

## Verification

- `npx --no-install tsc --noEmit`: passed after feature implementation.
- `node src/features/gamenight/verify.cjs`: 454 validated prompts, category counts, Fuse behavior, win directions/no row wrap, and 500 deterministic legal board simulations passed.
- `verify.sql` ran against the deployed database under the authenticated role: secret RLS before/after reveal; other-couple isolation; immutable answers and direct-write denial; typed matches/mismatches; alternating roles; ten-round scores and agreement stats; stale/finished actions; skip exhaustion/completion/end; all four Connect Four win axes, 42-move draw, gravity, full columns, rematch and undo rejection; custom sharing/ownership/type validation; malformed prompt and anonymous access rejection. All fixtures rolled back.
- `npx --no-install expo-doctor` ran once: 19/21 checks passed. Existing New Architecture warnings for react-native-incall-manager/react-native-webrtc, and seven Expo patch mismatches remain; no installs were performed.
- ADB is available but reported no connected devices. No native build or Expo export was run.

## Device limits and regression checklist

Android visual appearance, spring smoothness, wheel tick feel, screen-reader focus, actual two-device Realtime delivery, app kill/relaunch, background/reconnect recovery, and delivered notification taps remain unverified without connected Android devices. Database tests cover their persisted state/security contracts, not device delivery or rendering.

Checklist for a future device regression pass:

- Join each game from both profiles; kill/reopen during an unanswered and a revealed round.
- Verify one author's choice stays hidden on the other phone until both submit, including after restart.
- Try simultaneous starts, submits, next buttons and column taps; check there is one valid outcome and no duplicate stats.
- Check custom typed/four-choice/pair/truth/dare entries and custom-only mode.
- Check offline disabling and recovery, reduced/system/off motion, large text and narrow-screen column scrolling.
- Check wheel selection/ticks, skip exhaustion, optional end, disc falls, four win axes and draw/rematch UI.
- Check turn push, persisted cooldown, failed push notice and notification tap routing.

## Needs shared change

No shared change blocks Game night. In a dedicated maintenance session, reconcile Expo Doctor's patch mismatches for `@expo/ui`, `expo`, `expo-dev-client`, `expo-router`, `expo-screen-orientation`, `expo-splash-screen`, and `expo-updates`, and assess the two existing WebRTC New Architecture warnings. No dependency changes belong in this wave.

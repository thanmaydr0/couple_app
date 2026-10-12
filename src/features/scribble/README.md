# Scribble

Android draw-and-guess for two linked partners. Open Games → Scribble on both phones, start a match on one phone, then select the matching six-character match code on the other. Choose 2–10 rounds (default six). The previous drawer taps Next round to hand over drawing. After the last round, Play again creates a fresh match for both partners to join.

## Implemented

300 bundled words; three choices per turn; 80 seconds of active play; letter hints at 30 and 50 elapsed seconds; exact case-insensitive guesses, plural near-miss feedback; speed scoring; alternating drawer; round and final summaries. Guess points are 100 + 10 × remaining seconds (rounded up); drawer points are 100 + 5 × remaining seconds. A timeout awards neither player points.

Skia picture shared value renders normalized 1000 × 1000 coordinates on different phone sizes. React state never contains live points. Quadratic smoothing, 13 colors, four brush sizes, white eraser, undo and clear. Completed paths are cached; picture changes are coalesced to animation frames. Bounds: 200 strokes and 8,000 total points per round. Fill bucket is not included.

## Protocol and recovery

Private channel `scribble:<match_id>` uses `stroke` batches every 50ms with stroke ID, color, size and offset, plus complete `stroke_end`, `undo`, `clear`, `round_start`, `round_end`, `guess`, `hint`, `correct`, `sync_request`, `sync_state`. `ready` is a game-screen heartbeat (not Supabase Presence); `clock` mirrors the drawer's remaining time. Existing presence is only read. No track/untrack or presence-store writes.

The drawer owns the timer, answer and scoring. During play only the SHA-256 hash and mask leave the drawer; the word is revealed after the round. A guess is validated on the drawer, with final hash verification on a correct-round reveal. This is a trusted couple game, not cheat-proof competitive infrastructure: partners can edit their own clients and brute-force a small word list's hash.

Points and versioned phase metadata are stored inside existing `scribble_matches.scores` (`_scribble`), without changing the shared database types. Each committed transition uses an `updated_at` compare-and-swap. Scores and `rounds_played` persist before round-end broadcast. Secret word, remaining time and history are cached locally on the drawer; drawer loss without that cache ends the interrupted round without points. Return to lobby and resume if a concurrent screen changed the database version.

Rejoining requests full strokes/feed/phase. Guesser also requests a recovery snapshot every five seconds. Full stroke-end packets repair missed batches, offsets avoid duplicating points included in an in-flight snapshot, and the previous drawer can recover a dropped handoff. Canvas/history is recovered from the active drawer, not permanently stored on the server. If both local drawing caches are cleared, history cannot be reconstructed. Local and peer backgrounding pause the timer. A missing game heartbeat pauses within 3.5 seconds; app presence can pause sooner. Neither phone can play a round alone. Summary progression requires the previous drawer to return. Historical matches are left available in the lobby; Play again does not delete them.

## Database

`setup.sql` contains the two Scribble-only private broadcast policies. Applied to the configured Couple_app Supabase project on 2026-10-12 through the Supabase connector as migration `scribble_private_broadcast`. Existing match-table couple RLS and authenticated privileges were checked. Do not blindly rerun this file on that project: policy names already exist. On a new project apply after the base schema, once. No shared app files, native files or dependencies are changed.

## Verification

- `node src/features/scribble/verify.cjs` exercises the actual hook with two simulated clients, in-memory database compare-and-swap, broadcast and local storage: hints, scoring, stroke traffic, plural feedback, pause, lost handoff, reconnect history, alternating turns, timeout and persisted final scores. It also validates word uniqueness and malformed payload rejection. Native canvas rendering and transport are not simulated by that hook test.
- `npx tsc --noEmit`: no errors in Scribble or its route; other concurrently edited feature errors may remain.
- `npx --no-install expo-doctor`: 20/21 checks passed; existing react-native-webrtc and react-native-incall-manager flagged as untested on New Architecture.
- `verify-rls.sql` was executed against the configured project: match reads/updates and private broadcast inserts/reads succeed for the linked couple, and outsider reads, updates and broadcast writes are denied. The transaction rolled back; a follow-up query confirmed zero test accounts remained. The existing intentional `my_couple_id` security-definer helper and disabled leaked-password protection were the only security-advisor warnings.

## Device acceptance

Use two linked accounts on two Android phones with the existing development build. Check brush smoothness, different screen sizes, eraser/undo/clear, keyboard/send, hints and timeout, haptics, score persistence, background/return, network disconnect/reconnect during a stroke and during handoff, drawer app restart, 2- and 10-round matches, and Play again. A compatible Android development build containing the already-installed Skia dependency is required. No local native builds were run.

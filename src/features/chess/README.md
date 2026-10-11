# Chess integration

The route `app/games/chess.tsx` already exports this feature. All application
changes are confined to this folder and `app/(tabs)/games.tsx`.

## Database prerequisite

Apply `setup.sql` to the existing Supabase project after its base migrations.
This adds the partial unique index that prevents simultaneous New Game requests
from creating two active games, and private `chess:<couple UUID>` broadcast
policies for nudges. No new columns or shared TypeScript changes are needed.
This setup was not applied by this session. A read-only hosted catalog query
confirmed chess_games RLS and the supabase_realtime publication are enabled,
and confirmed this index and the chess broadcast policies are absent.
If duplicate active games exist, explicitly resolve them first;
the setup intentionally does not silently delete or end games.

The client validates legal moves with chess.js. The existing backend permits
couple members to update chess rows; it does not validate chess rules against a
modified client. Server-side rules enforcement would be a separate shared change.
Compare-and-swap writes guard FEN, turn, active status, and updated_at, including
draw actions that leave FEN unchanged. Failed writes restore the prior board and
refetch. Realtime events and reconnect/foreground events refetch persisted state;
a 15-second polling fallback recovers missed events. PGN replay preserves repetition.

## Verification

Run `node src/features/chess/verify.cjs` and `npx tsc --noEmit`.
No dependencies are installed and no native build is needed.

On two linked Android accounts:

1. Start games with white, black, random; simultaneously start on both phones.
   Confirm only one active game. Resume it from the other account.
2. Confirm black sees a flipped board, selection dots, coordinates, last move,
   check, SAN history, captures, and material. Check castling, en passant and
   each promotion option. Reject moves on the partner's turn.
3. Kill and reopen the app; join after several moves; background and reconnect.
   Confirm the same position and history. Disconnect before a move and confirm
   failed saves restore the board. Race moves with draw actions on both phones.
4. Offer, decline, accept draw; resign; finish by checkmate or automatic draw.
   Rematch and confirm colors swap. Confirm result and recent 100-game tally.
5. Check partner online status; send a nudge while both are in Chess. Confirm
   emoji and haptics. Nudges are ephemeral and are not push notifications.
6. Verify an unrelated couple cannot read/write chess rows or join the private
   broadcast topic. Check glyph appearance, accessibility and small-screen layout.

Device visuals, haptics, live authentication/RLS and two-client races have not
been verified in this session.

Session checks: the rule verification script passed. TypeScript reported no
errors in owned paths (the concurrent media feature had an unrelated error).
Expo Doctor passed 20/21 checks; it flagged existing react-native-incall-manager
and react-native-webrtc as untested on the New Architecture.

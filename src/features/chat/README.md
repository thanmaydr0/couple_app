# Couple chat

Implemented only in `src/features/chat`. The existing `app/(tabs)/chat.tsx`
already exports `Screen`; no shared files or dependencies were changed.

## Shared setup

1. Run `typing-policy.sql` in the project's Supabase SQL Editor. It adds
   SELECT/INSERT broadcast authorization for the exact private topic
   `chat-typing:<my_couple_id>`. The existing presence policies cover only
   `presence:` topics. There is no public fallback.
2. Verify the existing backend migrations are deployed: `messages` with unique
   `client_id`, couple RLS, recipient-only `read_at` updates, and the
   `supabase_realtime` publication; private `media` storage with couple path RLS.
   No additional message columns are required. Paths inside the `media` bucket
   are `<couple_id>/chat/<uuid>.jpg`.
3. Wire the badge in the shared `app/(tabs)/_layout.tsx`: import
   `useUnreadCount` from `@/features/chat`, call it once at the top level of
   `TabLayout`, and add `tabBarBadge: name === 'chat' ? unreadCount || undefined : undefined`
   to the mapped screen options. Consider `tabBarHideOnKeyboard: true` there
   for more composer space on Android. No shared edit was made in this task.
4. Verify the deployed `notify-partner` function and both accounts' push tokens.
   The exported `notifyPartnerOfMessage(message)` uses the existing function's
   `{ type, title, body, data }` contract. It never blocks send completion.

## Behavior and limits

- An inverted FlatList keeps newest messages at the bottom. Composite
  `(created_at, id)` cursors fetch 50 older rows; the same ordering catches up
  all missed inserts on reconnect. Live events do not advance the sync cursor.
- Optimistic bubbles and retries keep the same UUID `client_id` (and row ID).
  Retry first looks for an already accepted row, recovering ambiguous HTTP
  failures. Server state wins over late errors and cache; read receipts are
  monotonic in the local merge.
- Read updates require the chat to be focused and AppState active. They cover
  partner messages through the latest loaded server timestamp. This is a
  conversation-open receipt, rather than per-bubble visibility tracking.
- Photos are JPEGs capped at 1600px on the longest edge, quality 0.7. Failed
  uploads retain a document-directory copy across process restarts. Successful
  outbox files are cleaned on the next hydration. Upload retries reuse the
  same storage path. If a message ultimately never sends, its already uploaded
  object may remain in Storage; backend orphan cleanup is a separate concern.
- AsyncStorage retains at most 200 messages, prioritizing pending/failed sends.
  Interrupted sends reopen as failed, ready for explicit retry. This is a
  bounded outbox, not an unlimited offline queue. Text drafts are not persisted.
- Signed photo URLs are refreshed every 40 minutes, scoped to the account,
  and saved in a separate bounded 200-entry URL cache. Stable expo-image keys
  allow photos already downloaded to render from disk offline. Photos never
  downloaded require a connection; the image cache may evict older files.
- Text supports the Android emoji keyboard plus a quick emoji strip. Hold a
  bubble/photo for Reply / Info actions; swipe a confirmed bubble right to reply; tap failed-send text to retry. Tap a photo to
  enlarge it. Reply previews fetch older referenced messages on demand.
- Typing sends throttled active bursts and a debounced stop event, expires
  after 4.5 seconds, and sends no message body over broadcast. It stops on
  blur/background. Private authorization must be installed for it to work.
- Unread counts use an exact server count, realtime invalidation, foreground
  refresh and a 30-second fallback. Query failures preserve the last count
  (or zero before the first successful count).

## Verification

Run `node src/features/chat/verify.mjs` for deterministic reconciliation,
cache bounds, grouping, and date tests; `npx tsc --noEmit` for type checking.
The Expo Doctor result for this task is recorded in the final report.

On **two Android devices** signed into the seeded couple:

1. Exchange text/emoji and photos; ensure one bubble per send even when the
   insert response and realtime echo race. Check portrait/landscape images,
   permission denial, preview opening, and long-press photo replies.
2. Seed/send more than 100 messages and scroll up across page/date boundaries.
   Confirm equal timestamps do not skip rows. Scroll away from the bottom,
   receive messages, then use the new-message button without losing position.
3. Disconnect one device, send a failed text and photo, kill/reopen the app,
   then reconnect and tap retry. Confirm the same UUID produces one message.
   Receive more than 50 messages during disconnection; verify catch-up.
4. Check instant cached history offline and already viewed photos. Check
   expired signed URLs refresh when online. Inspect the resulting upload
   dimensions and JPEG output in Storage.
5. Check typing starts, expires after abrupt disconnection, stops after idle,
   send, tab switch, or background. Verify another couple cannot join the
   private topic or read messages/photos.
6. Keep chat blurred/backgrounded while receiving messages: unread count must
   rise and no receipt should be written. Focus/foreground chat: count clears
   and every outgoing read message shows double ticks.
7. Test Android edge-to-edge keyboard open/close, multiline input, gestures,
   small screens, font scaling, rapid sends and keyboard-covered controls.
8. Confirm partner push after a successful send, and that failed push does not
   change the bubble's sent state. No push is sent for a known duplicate retry.

Device rendering, authenticated RLS/broadcast behavior, Storage uploads,
realtime delivery and push delivery require this manual end-to-end pass.

## Warm Glow presentation pass — 12 October 2026

Visual reference: user-supplied `Us — Warm Glow.png`, replacing MCP per user
instruction after the Chat context/screenshot requests hit the Starter quota.
Shared Screen, Header, Avatar, MessageStatusTicks, TypingDots, Skeleton,
BottomSheet, ListItem and PressableScale are composed with theme/motion tokens.
Chat-specific presentation helpers stay in this folder.

Receipts derive from existing status and read_at only: sending / failed take
precedence, confirmed + read_at is seen, otherwise confirmed is sent. Every
outgoing text, reply and photo has ticks beside its timestamp. The existing
UPDATE channel and model are unchanged. Memoized bubbles keep receipt updates
local; quote comparisons ignore receipt-only changes. Tick springs run only on
mounted sending-to-confirmed transitions; remounted history starts settled.
Info selects by stable client_id so server confirmations and receipts stay live.
Unconfirmed timestamps are correctly labeled Queued / Not sent yet.

Presentation includes side springs for post-open messages in the first screenful,
a swipe arrow/haptic threshold, selected-bubble highlight, animated send control,
typing bubble, floating date and new-message pill, photo shimmer and indeterminate
upload ring. The pill counts arrivals while reading earlier history; it is not a
replacement for the server-backed tab unread badge. Existing conversation-open
markRead, scrolling policy, cache, typing and notification behavior are unchanged.

Deviations/limits: the reference is mapped to runtime tokens and 48dp controls,
not copied pixel-for-pixel. No new call/copy/delete actions. Wallpaper stays static.
Upload API has no byte telemetry, so no fabricated percentage. Sheet ticks use a
bubble-colored backing because shared tick ink is defined for outgoing bubbles.
No native build, device render, performance trace or authenticated two-device
regression was performed. Required phone checks are listed above; additionally
verify all four receipts, mounted receipt transitions versus history scrolling,
long-press Info live updates, swipe cancellation/threshold, Full/Reduced/Off,
Midnight/Rose/Noir, large text and keyboard/composer growth.

Validation: existing seven model tests pass; final `npx tsc --noEmit` passed.
Expo Doctor ran once: 19/21, with existing New Architecture warnings for
react-native-incall-manager/react-native-webrtc and nine shared Expo patch
mismatches. No installs or shared changes were made. Measured upload telemetry
and dependency remediation require a separate shared task.

# Couple chat and Chat Plus

Changes stay in the assigned chat folder, 200_chatplus.sql, link-preview folder
and the two assigned scheduler handlers. Existing routes, dependencies, native
folders, shared UI, Supabase client and scheduler registration are unchanged.
Presentation follows docs/design/SCREENS.md using theme/motion tokens.

## Built

- Live reactions: six quick choices, more/Android emoji keyboard, per-user
  toggle, counts, first-screenful pop, and double-tap hearts on text/photos.
- Server-enforced author edits for 15 minutes, edited labels, delete-for-everyone
  tombstones with server-cleared bodies, and no tombstone/system ticks.
- Shared pins with a horizontal bar, context jumps and highlighted targets.
- Search modal on the existing route: Fuse over loaded/cached history, fuzzy
  highlights, debounced ILIKE fallback (up to 50 older matches), photos/links/pins
  filters, and reply jumps. Context loads at most 50 rows on each side. Distant
  windows expose an explicit paged gap instead of implying continuous history.
- Send-button hold opens scheduling: calendar/time controls, tomorrow presets,
  author-private editable/cancellable jobs, daily morning/night helpers with
  editable random phrase lists and timezone-aware local-calendar recurrence.
- Couple timer Off/1h/24h/7d, system change messages, server-stamped expiry,
  immediate local expiry and RLS expiry filtering. Cleanup uses Storage APIs
  before deleting rows; reply foreign keys do not block purging.
- Opt-in view-once photos use a separate private bucket. The recipient gets
  an atomic one-time claim and 60-second URL. Closing/backgrounding deletes the
  object through the Edge Function; a queued purge repairs interrupted closes.
  Sender sees Opened. View-once images bypass normal signed-URL/disk caching;
  successful private sends remove their local outbox copy immediately.
- Open Graph cards with couple-scoped seven-day caching. SSRF checks reject
  local/reserved/IPv6 addresses, credentials, unsupported schemes and ports.
  DNS is validated and the actual TCP connection is pinned to a checked IP;
  TLS checks the original hostname. All redirects are revalidated (maximum 3),
  with an 8-second deadline, bounded headers/HTML/images and strict framing.
  Image bytes are proxied so OG hosts cannot target the phone's local network.

body.ts is the sole user-message codec and display/search/link projection.
Future E2EE should replace its encode/decode boundary, disable plaintext server
search, and decide how decrypted link previews and scheduled bodies are handled.
SQL treats scheduled bodies/phrase choices as bounded opaque strings.

## Preserved behavior and performance

- Optimistic UUIDs, explicit offline retries, ambiguous-timeout recovery,
  replies, JPEG uploads, bounded offline cache, and monotonic sent/seen receipts.
- Receipts still mean conversation open while focused/foregrounded, rather
  than individual bubble visibility. Expired/deleted/system rows do not count
  toward the unread badge. Existing shared badge wiring is already present.
- Unchanged rows retain object identity. Periodic reconciliation covers the
  latest 200, outbox and visible rows; old rows revalidate on entering view.
  Reactions also limit queries to recent/visible rows. FlatList stays virtualized.
- Animation is limited to the first screenful and respects Full/Reduced/Off.
  New tap targets use PressableScale and theme-derived 48dp minimums.
- Typing remains throttled to roughly 1Hz, now requiring partner presence on
  the private couple topic, and stops on blur/background. Migration includes
  the private presence/broadcast policies.
- After a distant context jump, the durable cache conservatively keeps the
  contiguous recent window plus outbox so disjoint windows are never reopened
  offline as apparently complete history. At most 200 messages are retained.

## SQL and Edge deployment completed

On project tlqedvktbgaipzhdgsuy:

1. Base schema/storage and scheduler infrastructure were already installed.
2. Applied supabase/migrations/200_chatplus.sql, including subsequent hardening,
   and reran it successfully to verify idempotency.
3. Deployed link-preview v4. It verifies tokens with getUser and resolves
   membership server-side. Gateway JWT checking is disabled because the
   function implements authentication itself.
4. Deployed scheduler v5 by preserving the deployed bundle and replacing ONLY
   scheduled_message.ts and disappearing_purge.ts. The existing authenticated
   cron is already active every minute. No secrets or cron configuration changed.
5. Removed all disposable live test users, couple, jobs, messages, preview rows
   and Storage objects. Rollback SQL tests also leave no fixtures.

No SQL or function deployment steps remain for the user.

## Verification

- npx tsc --noEmit: chat passes; globally passed at the final check.
- node --test src/features/chat/verify.mjs src/features/chat/verify-plus.mjs:
  16 passing tests, including all seven original reconciliation/cache tests,
  body privacy, identity reuse, SSRF normalization, chunk framing and pinned
  connections/redirect revalidation.
- verify.sql, run against the project with rollback-only fixtures: author and
  time-window enforcement, receipts, pins, reaction ownership, expiry RLS,
  forged system denial, timer messages, schedule ownership/lease/cancellation,
  private future bodies, one-time claims, idempotent recurring dispatch, reply
  purge and cross-couple isolation.
- verify-edge.mjs, using disposable authenticated accounts: unauthorized and
  unsafe URL denial, actual public preview fetch and couple cache, private
  uploads/direct-sign denial, author-open denial, one-time recipient viewer,
  Storage deletion, and authenticated tombstones.
- Existing live cron: scheduled message inserted exactly once across retries;
  both cleanup jobs completed and test Storage objects were absent.
- npx expo-doctor ran once: 19/21. Existing New Architecture warnings for
  incall-manager/webrtc and seven shared Expo patch-version mismatches remain.
- Security advisors: no missing-RLS tables introduced. The two authenticated
  SECURITY DEFINER APIs are intentional: both derive/check auth.uid and couple
  membership, enforce operation restrictions and use an empty search_path.

No native build, export, install or dependency change was performed.

## Could not verify without Android devices

Keyboard/layout, TalkBack, gesture arbitration, real two-device Realtime/typing,
offline process death, gallery permissions, image rendering, push display and
measured long-history scrolling require device execution. Backend access,
network protection, private Storage and cron behavior were verified directly.

## Regression checklist for device validation

- [ ] Text/emoji/reply/photo sends remain optimistic and produce one bubble
      when HTTP acknowledgement races Realtime; duplicate retry sends no push.
- [ ] Sending → sent → seen and failed → retry behave correctly in bubbles
      and Info; tombstones/system messages have no ticks; scheduled jobs have
      no sent/seen claims before dispatch.
- [ ] Background/blur prevents read writes and typing; foreground catches up
      more than 50 missed inserts; typing sends only with partner present.
- [ ] Offline cached history/photos still display; failed text/photo retries
      survive process death with the same UUID and durable local file.
- [ ] Long-press, swipe reply, single-photo open, double-tap heart, reaction
      replacement/removal and live count updates coexist without accidental sends.
- [ ] Edit before/after 15 minutes, delete body removal, pin/unpin, multiple-pin
      swiping, fuzzy search/filter highlights, reply/search jumps and gap paging.
- [ ] Schedule presets/custom dates, edit/cancel before claim, repeat helpers,
      phrase edits, timezone/DST behavior, and cancelling the next recurrence.
- [ ] Timer changes show one system message, affect new messages only, hide
      messages at expiry while offline, and eventually delete expired media.
- [ ] View-once is Off by default; locked receiver card opens once, sender
      sees Opened, close/background/network interruption cannot reopen it.
- [ ] Full/Reduced/Off motion, all themes, large text, 48dp targets, TalkBack,
      small screens, keyboard growth and scroll anchoring in long histories.

## Manual steps for the user

None for backend setup: migration, deployment, cron inspection and test cleanup
were performed directly. Device validation above remains unverified; no local
native build was attempted.

## Needs shared change

1. notify-partner must support a VERIFIED service scheduler caller plus
   scheduler_job_id, derive author/recipient from that job, validate its
   couple/message and deduplicate pushes. Its current getUser-only contract
   rejects scheduler tokens. Scheduled inserts/recurrence work and are
   idempotent; push failures remain explicit/retryable, then failed after the
   shared retry limit. The Scheduled sheet labels already-dispatched messages
   as Sent / push delivery needs attention. No user session is impersonated.
2. Shared dependency owner should resolve Expo Doctor's existing patch and
   native-library compatibility findings in its dedicated install/build wave.
3. The future privacy session should implement
   useViewOnceScreenshotProtection in ViewOncePhoto.tsx. It is deliberately
   marked as a hook which currently blocks no screenshots; the viewer says so.

New presentation/tap helpers are feature-local; no shared component edits are
needed. Native view-once screenshot protection was explicitly deferred by the
task, and scheduled push integration is outside the assigned writable paths.

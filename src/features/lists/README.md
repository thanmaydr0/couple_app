# Our Lists delivery

## (a) Built
Enabled the existing `/us/lists` route. Shared defaults and custom lists; couple-scoped Realtime/optimistic inserts and edits; progress rings; text/link ideas, notes and mood tags; long-press drag ordering and horizontal completion/removal gestures with button alternatives; completion check/Burst and reveal ceremonies; separate partner ratings; Skia picker and coin flip; optional photo memories.

Each partner owns a private Surprise Planner. Hidden item content is excluded by SELECT/UPDATE/DELETE RLS until its author reveals it. Revealed surprises appear under “Revealed for you” even though the author's planner remains private. Revealing is permanent. Gift wishes remain visible to both partners; claims are separate `list_items` rows with `url = us-list-claim:<original UUID>` and `hidden_from = wishlist author`. They cannot be revealed or mutated, only unclaimed. Mood tags use notes (`#cheap`, `#at-home`, `#outdoors`, `#fancy`) without changing the requested schema.

Removal is optimistic locally; its Undo toast remains until dismissed. Dismissing it, replacing it with another notification, or leaving the feature commits the delete. Undo cancels the delete before it reaches the server, preserving both ratings and attached media. Removing an item never deletes its memory. Completion Undo can be rejected if the partner has already rated it; their rating is never overwritten.

Photos use the existing private media bucket and `<couple>/photos/<item UUID>.jpg` / `<couple>/thumbs/<item UUID>.jpg` paths. The media row uses the item UUID for idempotent retries, `taken_at = now`, and caption = idea title. Photos are compressed before uploading. Hidden surprises must be revealed before a photo can enter the shared Memories hub. If media insertion succeeds but linking the item fails, retry finds the existing media row. An interrupted upload may leave retryable objects without a media row.

## (b) Verified
- `node src/features/lists/verify.cjs`: PASS for row validation, mood filtering, completed/claim exclusion, bound seed RPC, hidden-memory/account guards, picker denial/cancel, upload failure, Storage paths/caption/current date, retry deduplication.
- `npx tsc --noEmit`: no lists or route errors. The latest run had an error in the concurrently edited wallet folder; that folder was left untouched.
- `npx --no-install expo-doctor`: 19/21 checks passed. Existing New Architecture warnings for call libraries and seven Expo patch mismatches remain. No dependencies installed or changed.
- Migration deployed to connected project `tlqedvktbgaipzhdgsuy` (Couple_app).
- `rls.test.sql` executed against that database in a rolled-back transaction: defaults/seed idempotence, private planners, hidden surprise visibility, partner wishlist visibility, spoiler-safe claims, reveal, separate ratings, immutable ownership and cross-couple isolation PASS. Auth's existing profile-creation trigger was accommodated in fixtures. No synthetic users remain.
- Security advisors reported no lists findings; existing unrelated project warnings remain.

## (c) Cannot verify without an Android device
Native gesture arbitration with scrolling, reorder feel with variable-height rows, accessibility/large text and actual rendered contrast, all motion levels and animation smoothness, real photo permissions/uploads, Memories/Story rendering, reconnect/background behavior with two phones. No native build or Expo export was run.

## (d) SQL order
Existing base migrations (001_init, 002_storage, 100_infra and existing Memories permissions) precede `supabase/migrations/140_lists.sql`. Lists migration is already applied remotely; no user SQL action remains. The migration includes tables, constraints, RLS, access grants, invoker-only guards/seed function, indexes and Realtime publication membership.

## (e) Edge Functions
None required; none added. This feature sends no partner push notifications.

## (f) Manual steps
No user deployment/setup steps remain. Device-only validation above remains unverified; the connected browser cannot substitute for Android native libraries and gallery behavior.

## (g) Regression checklist
- Open both accounts together: four shared defaults plus each account's own private planner, without duplicates.
- Add wishes on both accounts; claim/unclaim the partner's wish; owner sees original wish and no claim.
- Write a secret; partner cannot query it directly; reveal once and verify “Revealed for you.”
- Add notes/link/mood; drag and use Move buttons; partner sees order changes.
- Complete and Undo; remove and Undo before dismissing; delete persists on dismiss/navigation; attached Memories survive removal.
- Rate independently; matching ratings show “You both gave it ⭐ 5”; direct attempts to alter partner ratings fail.
- Pick unfinished mood-matching ideas; flip coin; Reduced/Off suppress spinner movement; background stops the picker.
- Complete/reveal and attach a photo; verify current date, original title caption, Memories/Story inclusion; retry failures without duplicate media.
- Disconnect/reconnect and change accounts: no writable offline controls or previous account data; no broadcasts or subscriptions remain active in background.

## (h) Needs shared change
- Watch lobby must read the `title` query parameter passed to `/(tabs)/watch` and prefill/display that title. Lists emits the read-only handoff, but the receiving screen is outside this session's ownership and currently ignores it.
- Resolve existing Expo patch mismatches and call-library New Architecture warnings in the dedicated shared/native session.
- Feature-local Progress, Ceremony, Picker and ItemGesture remain in this folder; promotion to a shared UI module would be a separate shared change.
- Queries intentionally cap shared defaults/custom lists at 200 and ideas at 2,000; item-limit warning is displayed. The shared Realtime helper needs pagination for larger collections. Reveals have an additional foreground-only 30-second refresh because RLS-hidden subscriptions may not deliver the previously hidden row's change. No high-frequency broadcasts are used.

# Session B — Chat and Memories continuation brief

12 October 2026. This is a design specification, not a record of created frames.

## Access and scope

Target: https://www.figma.com/design/JwVhPmEJoyxV6ZO9JxfSe2

The connector exposes create/edit tools, but a read-only `use_figma` inspection on the previously selected Figma connection failed with: “You've reached the Figma MCP tool call limit on the Starter plan.” No canvas mutations were attempted or made. No new node IDs, screenshots, prototype connections or theme checks exist for B. Do not claim the existing representative screens satisfy this brief.

Read DESIGN_DIRECTION.md, TOKENS.md, SCREENS.md, CURRENT_SCREENS.md and FIGMA_INDEX.md before resuming. Existing inventory below is from those documents, not a successful live inspection. No Code Connect files were found by the repository glob check. Reconcile live components and instance properties before writing.

The session request explicitly authorizes Copy and Delete in the Chat actions sheet despite SCREENS.md excluding those additions. Label actions/info sheets and Copy/Delete as requested additions, not implemented app behavior. Do not invent editing, forwarding, reactions, search, calls inside a viewer or chat zoom. Chat image-upload percentage is a requested presentation; current upload API provides no measured byte progress. Use indeterminate progress until implementation supplies real progress.

## Construction contract

Every screen is an editable 412 × 915 Android frame, named exactly as listed below. Use Auto Layout for related content; constrain scrollable content between safe-area header and composer/tab bar. Screen gutters 24, normal gaps 8/12/16/24/32, targets at least 48, cards radius 20, sheet top corners 28, fields 16. Bind geometry to existing Spacing/Radius variables. Fraunces display/M or display/L for expressive empty/timeline headings; Plus Jakarta Sans body/M for messages, caption 12/18 for fully opaque timestamps, label for controls. Never use display type inside a bubble.

Use existing Components-page instances: Mine 4:203; Theirs 4:272; Tick indicator 4:122; Avatar 5:106; IconButton 5:10; TextField 5:32; Chip 5:39; Badge 5:113; Header 5:146; tab bar 5:227; sheet 5:243; Skeleton 5:268; Banner 5:278; Empty state 5:291; Typing dots 5:300; Date chip 5:303; primary button 4:29; secondary 4:57; danger 4:113. Inspect variants rather than assuming set IDs are instantiable.

Use existing Color semantics throughout: bg, bgElevated, surface, surfaceAlt, border, textPrimary/Secondary/Muted, primary/primaryContrast, accent, success, warning, danger, bubbleMineStart/End/Text, bubbleTheirs/Text, tickSent, tickSeen, overlay. Outgoing gradient uses both bound endpoints; incoming uses bubbleTheirs. Quiet wallpaper is a bg → bgElevated gradient with one broad curved tonal shape using surface; preserve message contrast. No hard-coded color literals. Never tint user photos/video to a theme.

The documented Starter file has three pages, eight separate Color collections and one mode each. Default to Midnight. If that limit remains, check Rose and Noir by rebinding every semantic paint and gradient-stop alias to the matching collection, including nested instance overrides, then restore Midnight. Merely setting another collection's explicit mode will not change Midnight bindings. If genuine Color modes now exist, switch those instead. Do not change the shared library or add pages without first inspecting current state. Flows is currently a section, 6:405, on Components; use it if a separate Flows page is still unavailable.

Use supplied media if present after inspection. Otherwise label discrete photo/video placeholders clearly; do not claim unsupplied photos are real assets. Never import a screenshot of the whole UI as the design.

## Chat frames

### Chat/Conversation/default

Header: 48dp avatar, two-line wrapping “Ananya Krishnamurthy”, presence dot plus “Online”, and separate 48dp voice/video buttons. Let identity wrap instead of shrinking call targets. A 24dp status inset and 88dp header are baseline specimens, not hard-coded Android runtime insets. Body has a quiet wallpaper; 364dp content width; bubble width at most 309dp; incoming left, outgoing right; 4dp same-sender and 12dp group gaps. Day chips “Yesterday” and “Today · 12 October”. Preserve history anchors.

Realistic conversation, all four outgoing statuses in one frame:

- Incoming: “Did you save the little video from our rainy walk?” 18:36.
- Outgoing, seen: “Yes. The part where we both missed the puddle 😂” 18:37, double vector tick in tickSeen.
- Incoming: “Send me the photo too. I want to keep that one.” 18:38.
- Outgoing reply: embedded quote “Ananya · Send me the photo too…” with rule and two-line limit; body “This one? My favourite from the whole afternoon.” 18:39, single vector tick in tickSent.
- Outgoing image: cropped image placeholder, ring and “Preparing photo…”; 18:40, clock plus Sending. If progress is available, replace with factual “Uploading · 64%”; never simulate current API progress.
- Outgoing: “We should go back next weekend.” 18:41, warning icon next to timestamp; below the bubble on bg, danger “Couldn't send · Retry”, 48dp retry target.

Timestamp and status appear on EVERY outgoing bubble, including replies/images; incoming has timestamp only. Use a compact caption row with trailing icon, no latest-only Seen heart. Show typing component below incoming group; jump-to-bottom pill “↓ 128 new” floats above composer without covering the last bubble. Its purpose is preserving position while reading earlier messages; do not auto-scroll then. Composer: attach 48, multiline field, send 48 when draft nonempty; reserved target space prevents field jumps. Keep existing emoji affordance. With no draft, send is absent/disabled according to the actual implementation, not replaced by a fictional recording action.

### Chat/Reply composing/default

Same conversation header and history. Above the composer add a surface reply bar with 3dp semantic rule, “Replying to Ananya Krishnamurthy”, one-line quoted message and 48dp cancel. Draft “This is the one I meant — look at the light.” Send visible. Composer grows upward, history remains anchored, keyboard region clearly marked as Android system UI. Long sender name wraps; unresolved originals use “Earlier message”, preserving the draft.

### Chat/Message actions sheet/default

Dim the conversation using overlay. Sheet lower on screen with handle, selected outgoing snippet and rows Reply, Copy, Message info, then a separated danger Delete row. Rows are 56dp minimum with editable line icons and text. Copy is for text; hide for pure photos. Reply only for server-confirmed messages. Pending/failed: use Retry where failed, disable reply to an unconfirmed ID. Copy/Delete are explicitly new requested UI; delete eligibility and backend behavior need implementation, not implied success. Delete must lead to a confirmation naming the message and its effect; no swipe-only destructive action.

### Chat/Message info sheet/seen

Conversation under overlay, selected snippet above metadata. “Sent” with single tick and “12 October 2026 · 18:39”; “Seen” with double tick and “12 October 2026 · 18:42”. Use textPrimary/tick on sheet surface, not bubble-local ink blindly. Full dates accessible. Keep two stable rows as receipt updates.

### Chat/Message info sheet/pending

Same sheet geometry: clock + “Queued · 12 October 2026 · 18:40”; “Not sent yet”; seen row “Not seen yet”. Failed variation adds danger status and Retry. Local enqueue time must never be labeled Sent. For confirmed messages without read_at, show canonical Sent timestamp and “Not seen yet”.

### Chat/Image viewer/default

Opaque bg, safe-area 48dp Close button, contained image in remaining area. No zoom/pinch affordance, metadata edit, download or Share controls: those are not in this chat viewer. Viewer remains dismissible during every state.

### Chat/Image viewer/loading

Same bounds, image skeleton and one labeled loading indicator “Loading photo…”. Avoid progress percentages for signing/loading without a measurable total.

### Chat/Image viewer/error

Contained error card “Photo couldn't load”, short explanation and Try again; Close stays available. Offline uncached variant says “Connect to load this photo”; cached images remain visible when available.

### Chat/Conversation/empty

Same partner header, centered quiet paired curves illustration built with editable token-bound vectors, Fraunces “Your everyday, together.”, body “Start with a little hello.” Composer remains the single primary action; no extra invitation feature or redundant CTA. Separate unpaired variant uses existing admin guidance, never a couple invitation flow.

### Chat/Conversation/loading

Header avatar/name skeleton; six varied incoming/outgoing skeleton blocks matching actual geometry, one image rectangle, composer disabled. One accessibility Loading status; no invented unread/presence/receipt values. Older-page loading is a small history-edge indicator with existing content retained.

### Chat/Conversation/error

Retain cached conversation and draft; banner “Couldn't refresh messages” with Try again. If no cache, centered contextual error with Retry under header. Failed sends retain their own receipts and retries. Avoid replacing all history for a recoverable sync error.

### Chat/Conversation/offline

Header “Reconnecting…” without online claim. Banner “You're offline. Saved messages are here.” Cached history visible; clock/failed statuses remain truthful; draft and outbox preserved. No claim of delivery or seen based on online/typing. Send behavior follows current outbox behavior; existing retry reuses client_id.

## Memories frames

### Memories/Timeline/default

Fraunces “Little moments.”, “128 memories” body subtitle, existing storage summary plus Download all/Clear cache secondary actions. Month heading “October 2026” sticks below header during scroll; day labels remain subordinate. Three-column grid in 364dp width with 8dp gaps, square tiles approximately 116dp. Mix photo tiles and videos with a readable backed “0:42” or “12:08” duration chip. Saved badge includes phone icon and two-line “Saved on this phone” on an opaque token surface; do not cram into illegible 9px type. Example days 12, 10, 3 October and 29 September. Floating Add 56dp above bottom nav, primary contrast icon, sole primary action. Existing download/cache controls never masquerade as deleting originals.

### Memories/Upload sheet/uploading

Timeline visible under sheet. Header “Adding 3 moments”, secondary compression note “Photos and videos are compressed before upload.” Three per-file rows: rainy-walk-anniversary-take-03.mp4, Preparing 24%; sunday-coffee-window.jpg, Uploading 64%; train-home-portrait.jpg, Waiting. Each row has thumbnail, wrapping filename, human status, ring with explicit percentage when measured. Show separate status phases; no claim that compression percentage equals sent bytes. Done row uses check and “Added”; skipped row says “Still 50 MB or larger. Trim the video and choose it again.” No new background-upload guarantees or cancel-upload feature. Android picker remains system UI.

### Memories/Photo viewer/default

Safe-area Close and “37 of 128”; contain photo with enough room for scrollable metadata/actions below. “12 October 2026”, caption field with realistic two-line caption “A rainy afternoon, warm coffee, and absolutely nowhere else to be.” Save caption primary only while editing; otherwise Save to gallery is primary with Share secondary. Delete separate and shown only for uploader. Existing pinch 1–5×, two-finger pan, double-tap reset and horizontal paging are preserved. Caption/actions reflow at large type; do not fix media height to screen-minus-300.

### Memories/Video viewer/default

Same chrome/metadata hierarchy; native video playback controls in media region with duration 12:08 and current time 0:42. Pause when page inactive. Do not draw decorative overlays over playback, autoplay claims or unsupported custom player features. Save/Share/Delete follow photo eligibility.

### Memories/Viewer/loading

Close and “37 of 128” remain; media skeleton plus “Downloading video…” or photo label, action busy states disabled consistently. No fake total percentage where unavailable.

### Memories/Viewer/error

Media error with Try again, preserved index/date, Close available. Distinguish uncached offline “Connect to open this memory” from decoder/download failure. Downloaded originals can open offline; thumbnail alone is not a downloaded original.

### Memories/Timeline/empty

Fraunces “Keep the little things.”, body “Your photos and videos, in one place for two.” Editable floating polaroid illustration: three gently rotated rounded surface cards with blank/photo-placeholder interiors and short caption strokes; no hearts or mascot. A single primary “Add a memory”; suppress redundant floating Add in this state. Empty is 0 memories, not a synthetic skeleton.

### Memories/Timeline/loading

Heading/count/storage skeletons, two month-heading placeholders and nine square tile skeletons, disabled Add. Exact grid geometry matches populated view. One accessibility Loading status.

### Memories/Upload sheet/error

Retain successful/waiting rows; failed video has danger icon, “Upload didn't finish”, short connection/storage explanation and per-file Retry. Filename wraps; ring must not continue spinning for failed status. No celebratory completion if any row failed. Permission-denied variant explains Android photo access and existing Settings route to OS; native permission dialog is not replaced by this sheet.

### Memories/Timeline/storage almost full

Retain timeline with warning banner “Phone storage is almost full” and “Free some space before downloading more.” Clear cache secondary action explains it removes local copies only; confirm before clearing. Do not present phone space as shared-cloud capacity. For backend bucket errors, use separate upload error copy and admin advisory without invented quota meter. Never manufacture a precise storage percentage absent real data.

### Memories/Timeline/error

Retain cached tiles; banner “Couldn't refresh memories” and Try again. Individual failed thumbnail has localized retry and video/photo identity. If initial load failed without cache, contextual retry replaces the grid. Draft caption is preserved on mutation failure.

### Memories/Timeline/offline

Banner “You're offline. Open memories saved on this phone.” Downloaded badges remain readable; unsaved tile indicates network required. Add and Download all disabled; Clear cache may remain available with confirmation. No promise to queue uploads offline.

## Receipt contract and motion boxes

Derived receipt order: sending, failed, otherwise sent+read_at → seen, otherwise sent. Sent means server-confirmed, not device-delivered. Every outgoing timestamp shows clock, single tick, double tick or danger warning as appropriate. Tick ink uses bubble-local semantic variables; on sheets use surface-appropriate semantic ink. Status meaning is also available through labels/accessibility, never color only.

Place a text box titled “Motion notes” beside EVERY frame, approximately 280dp wide, never inside the export. Include its own screen-specific enter, press, transition and special-state behavior:

- Conversation: 240ms fade/8dp enter once; new outgoing 8dp rise; incoming fade only near bottom; 160ms send scale/fade when draft becomes nonempty; unread pill fades; status changes draw second tick 160ms, ink 240ms. Typing loops only while genuine typing signal active. Never animate wallpaper during reading.
- Reply: 160ms bar expansion/collapse preserving scroll anchor; cancel and send press scale 0.96; no bounced keyboard/content.
- Sheets: gentle spring enter, overlay fade, rows scale/tint on press; info live receipt fade 160ms without row movement; destructive confirm retains selected snippet.
- Chat image: 240ms fade enter/exit; image load crossfade; retry progress is functional; no promised shared-element zoom.
- Timeline: 240ms enter, newly added tiles only short stagger; sticky month swap 160ms; Add press snappy, storage banner appears without moving reading position unexpectedly.
- Upload: linear measured rings, phase labels crossfade; done check 160ms, errors stop spinners; no success animation until actual completion.
- Memories viewers: direct pinch/pan; gentle double-tap reset; paging without decorative playback animation; action success only after real completion.
- Empty: polaroids/curves may settle 8dp over 240ms once; do not loop or drift behind composer.
- Loading/error/offline/storage: static fallback geometry, retained content; skeleton shimmer only Full; error does not shake content; offline has no endlessly pulsing banner.

All boxes additionally say: Reduced uses static typing/clock/skeleton and fades ≤160ms; Off is immediate; functional video/timer/progress still updates. System reduced motion wins. Controls press scale 0.96 with snappy spring only Full; use tint in Reduced/Off.

## Prototype and verification checklist

On Flows page/section, reuse B instances or linked frames for Conversation → Actions → Reply → Conversation; Actions → Info → Conversation; image bubble → viewer → back; Memories timeline → upload → success/error; tile → photo/video viewer → back. Link only actual targets, preserve matching layer names for Smart Animate at 240ms (Reduced 160ms dissolve). Include failed-send Retry specimen without implying a real backend connection. Calls go to existing call frames only if verified live. Do not invent Copy/Delete success screens; annotate additions and confirmation requirement.

After construction inspect editable node types, instance links, font families, image-filled node bounds, overflow and every frame's 412 × 915 dimensions. Take a composition screenshot and targeted fixes, then a post-fix screenshot only if needed. Check every frame in Midnight, Rose and Noir. Verify 4.5:1 body/metadata/ticks through both gradient endpoints and overlays; 3:1 controls/focus. Check long names, 128 counts, filenames, multiline drafts, 200% Android text, keyboard, sheet navigation, three-column badges, active-video controls and safe areas. Runtime/device behavior, backend receipt timing, uploads, network recovery and permissions require later Android testing.

## Session verification and shared changes

The five required docs and source evidence were read. `npx tsc --noEmit` ran; its sole reported error was outside this session in src/theme/ThemeProvider.tsx (StatusBar backgroundColor prop). No TypeScript files belong to this docs-only session. `npx --no-install expo-doctor` was invoked once to avoid installing a dependency; record its result in FIGMA_INDEX_B.md. No native builds, exports, installs or shared app edits.

Needs shared change after design review: implement theme bindings/fonts; per-message vector receipts and metadata sheets; Copy/Delete behavior with backend authorization/confirmation; real Chat upload-progress telemetry; requested sheet presentation and animations. Dependencies and shared source remain outside B's scope. Unblock Figma quota/access before attempting canvas work; no quota reset time was supplied.

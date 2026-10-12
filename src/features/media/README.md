# Memories: Android setup and verification

The existing Memories route exports this feature. No shared files or dependencies were changed.

## Deployment status — 12 October 2026

Applied `memories_uploader_permissions` through the Supabase plugin to the configured `Couple_app` project (`tlqedvktbgaipzhdgsuy`). Confirmed the private bucket's 50 MiB limit and `media` Realtime publication. Live database tests using synthetic users/objects inside a rolled-back transaction passed uploader insertion/retry/deletion, partner reading/caption editing, blocked spoofed uploaders/ownership mutation/partner deletion/overwrite, and isolation from unrelated couples. Storage deletion authorization was checked by evaluating the installed deletion policy; actual Storage API deletion still needs a device check. No test fixtures remain.

Only `caption` is updateable by authenticated clients. Security Advisor reported existing warnings for leaked-password protection being disabled and the signed-in callable `my_couple_id()` SECURITY DEFINER helper; neither unrelated setting was changed. New project setups must still follow the steps below.

## Backend setup

Apply the repository's existing schema and storage migrations first, then review and run `permissions.sql` beside this file in the Supabase SQL Editor. The base schema permits either partner to delete any row; this script enforces uploader-only deletion, immutable paths/ownership, and caption-only updates. Do this before releasing. Verify the `media` table belongs to `supabase_realtime` and the private bucket `media` has a 50 MiB limit. Test with two couple accounts and a third unrelated account: third-party selects/signing must fail; partner deletion and uploader reassignment must fail; both partners may edit captions.

Project-wide Supabase storage usage cannot be measured using an anon client. The screen displays this couple's known original bytes and warns above 900 MiB; this excludes thumbnails, other buckets and other couples. Check actual quota in the Supabase dashboard. Device free-space warnings use the phone's real available bytes.

## Android device checks

Local automated service checks: `node src/features/media/verify.cjs`. These mock Android and Supabase boundaries and cover date fallback, signed URL batching, duplicate download prevention, concurrent index writes, offline rehydration, account isolation, two-worker concurrency, screen dismissal, retries, lost database responses, strict file-size rejection, and clearing cache. They do not validate native codecs, gallery permissions, or live RLS policies.

Use an existing Android development client with the installed native modules (compressor, gestures, video, picker, library). No local native build is required or performed by this feature.

1. Multi-select portrait/landscape photos and videos, including HEIC and a large video. Verify JPEG max dimension 2560 and quality 0.8, MP4 size strictly below 50 MiB, and explicit skipped-file feedback if compression cannot reach it. Verify EXIF dates, gallery creation dates, and modification-time fallback.
2. Queue several files. Navigate to another tab mid-upload. At most two files prepare/upload at once; work continues while the app process stays alive. Disconnect mid-upload, reconnect and retry. A lost insertion response must not duplicate a memory. Force-closing the app does not preserve unfinished jobs.
3. On two phones, add a memory and confirm the partner sees it live. Pull to refresh. Check date grouping/sticky headers and scrolling with more than 500 memories.
4. Swipe the viewer, pinch photos, drag with two fingers, and double-tap to reset. Play/pause/seek a video and swipe away; previous playback pauses. Test rotation, captions, Android Back, gallery permission denial, save and share. Only the uploader should see Delete. Confirm backend policies also reject partner deletion directly.
5. Open photo and video originals, see Saved on this phone, then restart offline and reopen them. Test Download all, interrupted downloads/retry, low disk space, and Clear cache. Phone gallery copies must remain. Signing URLs are held in memory only, renewed before one hour; metadata and local file paths are persisted per signed-in account/couple.
6. Sign out and switch accounts: cached timeline must never appear under another account. Unlink/relink couple online and verify the screen changes scope.

## Current limits

There is no jump-to-date scrubber. Upload queue lifetime is the running app process. Failed uploads can leave deterministic, retryable objects without a timeline row; retry those jobs before closing the app, or remove orphan objects in Storage manually. Deletion removes objects before the row, so a partial deletion failure remains retryable from the timeline. Offline cache persists until cleared on this device; remote deletion does not erase exported gallery copies. A fresh install requires one successful online profile lookup before offline couple recovery is possible.

## Warm Glow presentation restyle — 12 October 2026

Reference: user-supplied `Us — Warm Glow.png`, used instead of Figma MCP at the user's request. Memories uses the shared Screen, Header, Card, Text, BottomSheet, Badge, Slider and PressableScale with theme and motion tokens. No service, query, Realtime, upload/compression, cache, Storage path, database type or route changes.

Timeline: translucent themed sticky month/day layers, themed refresh, first-eight-only staggered scale/fade tiles, floating Add, shimmer skeletons, floating polaroids (loop only in Full), readable saved badges, retained offline/error/storage warnings. The upload sheet calls the original Android multi-select picker and shows actual per-job progress, success strokes, failure shake, retry and compression guidance. Completed jobs remain visible until the existing enqueue logic replaces them.

Viewer: tile-center scale/fade fallback instead of a measured shared-element resize, pinch/two-finger pan, double-tap zoom/reset, swipe-down dismissal with fading backdrop and spring return, themed fading video playback/seek/mute/full-screen controls (native controls in full screen), scrollable caption/actions, shrink-out after confirmed deletion. Native page snapping is retained rather than replacing the existing pager with a custom spring driver.

Deviations and limits: no reversible deletion/Undo toast. The existing remove handler deletes Storage objects first; a genuine Undo requires a separately authorized deletion lifecycle/backend change. The supplied PNG does not specify detailed viewer/upload layouts, so those follow SCREENS.md and the requested effects. The polaroid illustration is built from themed feature-local views/icons. Presentation.tsx and styles.ts stay feature-local; promote reusable pieces only through a separate shared change. Native rendering, large text, AA contrast over actual photos, sheet/gesture interactions and animation smoothness remain Android device checks.

Phone regression checklist (not verified on a device in this session):

- Multi-select several photos and a video; inspect progress, compression note, success, skipped file and failed Retry.
- Check chronological order and sticky grouping, pull to refresh, and partner uploads arriving live on a second phone.
- Download to phone, confirm the saved badge, restart offline and open downloaded photos/videos.
- Open/close from different tiles, pinch and double-tap, pan with two fingers, page horizontally, dismiss downward and use Android Back. Verify Full, Reduced and Off.
- Play/pause, seek, mute and full screen a video; verify playback pauses when leaving the page.
- Delete an owned upload; cancel a deletion and retry a failed deletion. Partner uploads must have no Delete action.
- Edit/save a caption, save to gallery (including permission denial), and share.
- Inspect Midnight/Rose/Noir, Android large text, minimum touch targets, readable saved badges and low-storage/error/loading/empty states.

Validation: TypeScript and the existing mocked media service checks; Expo Doctor 19/21, with existing call-package New Architecture warnings and nine Expo patch mismatches. No installs, exports, native builds or backend changes.

# Android widgets

The existing four registered Android widgets are implemented entirely in feature JavaScript. No new widget types, dependencies, native edits, or local native builds were added.

## Behavior

- **UsWidget (4×2)**: days since the couple anniversary, partner name, Pulse mood/availability when available, and the nearest future countdown. Missing anniversary/status/countdown data is omitted. Tap opens Home through `us://`.
- **PhotoWidget (2×2)**: latest upload, deterministic daily random, or deterministic daily widget favorite. Calendar day uses the device's local date. Photos are ordered by upload timestamp then ID, so the same data and day select the same photo after restart. New uploads can change the daily selection. Favorites are widget-only selections on this device; the shared Memories schema has no favorites column. Tap opens the existing Memories Viewer inside the widget-owned route with the selected photo.
- **DoodleWidget (4×2)**: latest doodle authored by the partner, never your own drawing. The Skia pad provides theme brush colors, undo, clear and PNG send. Tap opens a reply canvas using the partner's latest cached doodle as its background. Clear removes that background. The transmitted drawing includes the reply background; undo removes your last stroke.
- **HeartbeatWidget (1×1)**: custom headless click, no app launch. The existing Pulse sender requires active AppState and cannot send headlessly, so `widget_heartbeat()` writes a normal Pulse heartbeat event with Pulse's own day calculation/RLS. A notify-partner push follows. Local durable and server transaction cooldowns are 10 seconds. Timestamped sent/error feedback displays briefly, then returns to the heart; this is a static-state change, not a smooth native animation. RemoteViews use rendered bitmaps.

## Privacy, storage and failures

Personal widget content is OFF by default. The Widgets screen explains Home-screen visibility and has a visible off/clear switch. Signing out or switching accounts clears widget state and files when WidgetSync observes the session change. WidgetSync is already mounted; it mirrors resolved theme/accent colors from useTheme into AsyncStorage for headless rendering. No extra token copy or service key is stored by the feature: it uses the shared Supabase client's persisted session. Background downloads resolve private signed URLs through that session and RLS, never a URL supplied by a push.

The private doodles bucket limits PNG uploads to 1 MB. Rows and Storage paths are scoped to couple/author. Only authors can insert/delete; both couple members can read. Push claims are server-only, deny client access, and intentionally have no client RLS policies (the database advisor reports an informational no-policy finding for this intentional deny-all table). The two RPCs use SECURITY INVOKER, with separate authenticated/service-role execute grants. Claim receipts prevent replay and serialize a 30-second couple push cooldown. Server credentials stay in Edge Functions.

Widget images are downscaled with the installed react-native-compressor to at most 360×360 JPEG, quality 0.65, and rejected above 350 KB. Only the current photo and partner doodle files are retained. ImageWidget consumes a temporary base64 data URI read from those local files because its installed API does not accept file URIs. No large originals are passed to RemoteViews. Full uploaded drawings remain private in Storage and doodles rows; there is no automatic deletion of cloud history in this feature.

Offline refresh retains saved content and records an error, rather than claiming a successful sync. Health displays the last successful data fetch and saved error; it cannot prove launcher draw success, push delivery, or partner viewing. A saved doodle is retained if push dispatch fails; the UI reports the refresh failure. Without a valid stored session, background fetch/heartbeats cannot succeed.

## Refresh limits — read before relying on daily refresh

Android does not provide exact scheduled widget refreshes. The library documents that `updatePeriodMillis` requests run no more often than once per **30 minutes**, and power/Doze/OEM restrictions can delay work further. Its installed 0.22.1 widget headless worker has a **30-second** JS task timeout. Network operations should stay short; queries and image download cancellation have 8-second limits, but device scheduling and compression duration still require device validation.

**Important current build limitation:** all four existing registrations in app.json have `updatePeriodMillis: 0`. Thus there are **no automatic periodic callbacks** in this build, and a photo does **not** change reliably at midnight while the app is closed. The handler supports WIDGET_UPDATE if a future N0 build enables it; this session did not change native config. Do not present periodic fallback as working today.

Refresh triggers implemented now:

| Trigger | Behavior |
| --- | --- |
| App opens/returns to foreground | Fetch private widget data and request widget redraw |
| Foreground photo, doodle, Pulse status or countdown change | Couple-scoped Realtime triggers a coalesced refresh; subscriptions stop in background |
| Foreground local calendar date changes | Refresh daily selection; the date check runs while JS is active |
| Photo mode/favorites/theme change, explicit Refresh | Request redraw; photo settings refresh data |
| Widget added or resized / OS WIDGET_UPDATE | Headless handler fetches and redraws |
| Partner uploads a doodle | App invokes widget-push; notify-partner sends high-priority data-only Expo push |
| Push is delivered and Android executes the registered Expo task | Read stored session, fetch/download the latest partner doodle, invoke the widget library redraw API without opening React UI |
| Heartbeat tap | Library custom headless click calls RPC and sends partner notification |

Push-triggered refresh can happen promptly after delivery but is **best effort**, never guaranteed instant. Notification permission/token setup, network, Android power management, OEM background restrictions and force-stop affect delivery. A data-only push alone does not automatically invoke the widget library: `background.ts` defines an Expo notification task at module scope, imported by the existing widget registration entry, and WidgetSync registers it. The shared deployed notify-partner already supports `dataOnly` and `priority`; its version 7 was inspected. No shared notifier edit was needed.

Clicks require Android 7+. OPEN_URI uses the existing `us` scheme and routes. The library renders a bitmap; launcher-reported dimensions can differ and crop content. Check each size on actual launchers. The inherited Heartbeat registration has a 40dp native minimum: our in-app controls have 48dp minimums, but guaranteeing a 48dp widget touch region on all launchers needs the native registration adjusted by N0.

Sources checked October 13, 2026:
- [Library updates / 30-minute minimum](https://saleksovski.github.io/react-native-android-widget/docs/update-widget)
- [Headless handler and async work](https://saleksovski.github.io/react-native-android-widget/docs/api/register-widget-task-handler)
- [Click actions / OPEN_URI](https://saleksovski.github.io/react-native-android-widget/docs/handling-clicks)
- [Bitmap and launcher sizing limits](https://saleksovski.github.io/react-native-android-widget/docs/limitations)
- [Expo background notification tasks](https://docs.expo.dev/versions/latest/sdk/notifications/#registertaskasynctaskname)
- [Storage RLS](https://supabase.com/docs/guides/storage/security/access-control)

## Deployment and verification

Project: `tlqedvktbgaipzhdgsuy` (matches local public Supabase URL).
SQL order: existing base schema and `110_pulse.sql`, then `370_widgets.sql` (applied remotely in this session). The private bucket and permissions are included; no separate bucket creation is needed.
Edge Functions: existing notify-partner, then widget-push (deployed remotely with JWT verification enabled; the body also validates the user's token and author ownership). No new secret is required.

Run `node src/features/widgets/verify.cjs` for deterministic selection, concurrent/restarted heartbeat cooldowns, disabled fetch gating and cache reset. Run `src/features/widgets/verify-rls.sql` as a rollback-only backend regression with paired test profiles: owner/partner visibility, outsider isolation, author spoof rejection, headless heartbeat cooldown and privileged push-claim denial. It does not deliver real notifications or persist test data. TypeScript and Expo Doctor results are in the final report.

No connected Android device was available. Backend deployment/setup has been handled; the following is the remaining device acceptance checklist, not a claim of completed validation:

- Add all four widgets on a supported launcher; verify cell sizes, clipping, contrast and long partner/countdown names.
- Enable personal content, change each theme/accent, verify widget palette; turn content off and sign out while a refresh is in flight, confirming cached photos/doodles disappear.
- Verify latest/random/favorites with zero/one/many photos; upload/delete photos and check foreground updates. Verify a local date rollover while open. Confirm there is no promise of closed-app midnight refresh in this build.
- Open PhotoWidget into the correct Memories viewer and close it; Home tap returns Home.
- Draw, undo, clear, send; check partner receives only the latest partner-authored doodle and opens a prefilled reply canvas. Verify empty canvas/send disabled states.
- Test data push with app foreground, background, cold process, offline, Doze and force-stop; reopen to confirm fallback catches up. Confirm denied notifications/missing tokens do not masquerade as delivery success.
- Tap heartbeat while app is closed: app must remain closed, partner event count increments once, rapid/cold-restart taps respect cooldown, brief sent/error state returns to heart.
- Deny network and expire the session: no false sent result; saved refresh errors visible in health.
- Test large font/TalkBack, drawing touch handling, Reduced/Off motion and app-lock/ringing regressions.

## Needs shared change

N0 must enable a nonzero updatePeriodMillis (at least 1800000) for periodic fallback and the closed-app daily photo refresh approximation. N0 should raise Heartbeat's inherited minWidth/minHeight to at least 48dp. Neither is changed here because this task forbids native config edits. Expo Doctor reported existing WebRTC/InCallManager New Architecture warnings and seven shared Expo patch mismatches; package changes belong to the dependency/native wave. Feature-local Action and preview illustrations remain inside widgets; promote only in a separately owned shared change.

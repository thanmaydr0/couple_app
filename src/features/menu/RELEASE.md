# Us 1.1.1 Android release — 18 October 2026

## (a) What was built

- A searchable All features directory covering 30 destinations in Connect, Play & watch, Memories & milestones, Everyday together, and Privacy & settings. It includes every enabled registry feature plus the main chat/media/game/call/settings destinations. Home has a menu icon and a prominent All features button; Settings also links to the directory. Existing routes and the five-tab layout are preserved. Hidden home shortcuts remain accessible in the directory.
- Touch Together: deployed the missing private Realtime SELECT/INSERT policies for broadcast and presence. Topics match only the authenticated user's `my_couple_id()`. Background transitions now send release before untracking. Reconnect and failed-send handling clear cached coordinates so touching the same point again is transmitted.
- Registered location's existing headless module before Router and connected call/location notification handlers through the existing ringing dispatcher. Sign-out first stops location sharing while credentials are valid.
- Supplied the missing production `EXPO_PUBLIC_MAP_STYLE_URL` through EAS, using OpenFreeMap's documented public Liberty style. No provider secret is required. Source: https://openfreemap.org/quick_start/ . The URL was configured in production only.
- Moved the app lock above application providers and explicitly gated the native call modal on lock visibility. View-once photos now wait for screen protection before showing their native modal.
- Updated release version to 1.1.1 / Android versionCode 3; package and lockfile root metadata match. The new appVersion runtime prevents older 1.1.0 OTA updates from replacing this release's bundle. No dependencies were added or installed, and no native folders were edited.
- Updated old chat, voice and notification test fixtures for the already integrated encryption imports and server-validated call notifications. Their behavioral assertions remain; encryption is separately exercised by the E2EE suites.

## (b) Verification

- `npx tsc --noEmit`: passed for the complete application after the production source edits.
- The initial deterministic sweep ran 35 suites and exposed three stale harnesses. After correcting those fixtures and adding the menu coverage, the final complete sweep passed all 36 suites with zero failures.
- `node src/features/touch/verify.cjs`: passed, including added same-position reconnect and immediate background release checks.
- `node src/features/touch/verify-live.cjs`: passed against the actual project with both existing paired account fixtures. Both joined the private Touch topic, published/observed presence, and exchanged ready/touch/up in both directions. A random unrelated couple topic was denied. This test sends no push notifications and changes no persistent user content.
- `node src/features/menu/verify.cjs`: passed: 30 unique entries, real route files, categories, search and disabled-feature handling.
- Location privacy tests: 11 passed. Ringing tests: 3 passed. App-lock gate lifecycle tests passed. Voice tests: 5 passed. Notification server tests: 6 passed; current Edge Function tests: 4 passed.
- `npx expo-doctor`: run once; 19/21 checks passed. Findings are existing Expo patch mismatches in 11 dependencies and missing New Architecture test metadata for WebRTC/InCall Manager. Dependency changes are excluded by the standing no-install rule; warnings were not hidden.
- `git diff --check`: passed.
- Android production cloud build requested through the existing EAS profile, with `--non-interactive --no-wait`. Build completion and APK installation are deliberately not monitored, per the user's instruction.

## (c) What could not be verified without a device

`adb devices -l` found no connected Android device. Physical touch gestures, visual layout on Android, vibration timing, native screenshot protection, biometric locking, camera/microphone/Bluetooth, background call and location service behavior, FCM display, map rendering, widgets and APK installation remain unverified on hardware. Automated coverage does not establish that every feature is defect-free.

The existing call service deliberately falls back to foreground-only behavior while a location foreground service is active. Supporting both services concurrently remains a native/service coordination limitation; this release does not claim that simultaneous background behavior is verified.

## (d) SQL to run, in order

Already applied to `tlqedvktbgaipzhdgsuy` as `touch_private_room`; no user SQL steps remain. Repository copy: `supabase/migrations/20261018065946_touch_private_room.sql`. Live catalog inspection confirmed both authenticated policies after deployment. No tables, stored touch data or public-channel workaround were introduced.

## (e) Edge Functions to deploy

None changed. Existing notify-partner, turn-credentials, scheduler, link-preview and widget-push functions were confirmed ACTIVE. This is a deployment-presence check, not full end-to-end validation of every function.

## (f) Manual steps for the user

None requested. Hosted policy/configuration changes and cloud build submission were handled here. APK completion monitoring is intentionally left stopped at the user's request; there is no connected device on which the agent can install or exercise it.

## (g) Regression checklist

Automated: TypeScript; all deterministic feature suites; Touch paired private access and foreign-topic denial; Touch release/reconnect/rate limiting/background cleanup; menu route coverage/search; location opt-in/Stop/expiry; app-lock lifecycle; voice focus/receipts; call notification validation; encryption boundaries.

Hardware coverage remains as listed in (c), with no manual actions assigned to the user by this report.

## (h) Needs shared change

No shared source integration is left for another session for the fixes above. Remaining maintenance is the existing Expo patch-version alignment and hardware verification. Dependency/native changes require their dedicated maintenance scope. The present build uses the installed dependency set that previously produced a successful SDK 57 Android APK.

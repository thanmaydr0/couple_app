# Android native foundation — 1.1.0

Prepared on 2026-10-13 for Expo SDK 57 / React Native 0.86.3. Android only;
New Architecture and Hermes are enabled by the generated Expo template.
No feature implementation, backend changes, or native source edits.

## Native inventory

Versions below are the package.json ranges; package-lock.json pins the build.
Only the requested libraries and the selected call/service library were added.

| Library | Version | Purpose | Change / setup |
| --- | --- | --- | --- |
| expo-audio | ~57.0.5 | Voice notes and ambient sound | Existing; plugin enables background playback and recording capabilities |
| expo-location | ~57.0.21 | Live location, geofencing, background updates | Added; plugin enables background location and foreground service capabilities |
| expo-task-manager | ~57.0.21 | Background location task execution | Added; autolinked, no separate Android plugin needed |
| @maplibre/maplibre-react-native | ^11.5.0 | Native maps | Added; official config plugin; requires RN >=0.80 and New Architecture |
| react-native-webview | 13.16.1 | YouTube sync and PDF preview foundation | Added; SDK-selected version, Android autolinking |
| expo-local-authentication | ~57.0.3 | Biometric lock | Added; official permission plugin |
| expo-screen-capture | ~57.0.4 | Screenshot blocking | Added; Android autolinking, blocking must be explicitly enabled by a feature |
| expo-crypto | ~57.0.4 | Secure random generation | Existing; refreshed SDK-compatible patch, autolinked |
| expo-battery | ~57.0.3 | Battery level | Added; Android autolinking |
| expo-print | ~57.0.2 | PDF keepsake creation | Added; Android autolinking |
| expo-sharing | ~57.0.23 | PDF sharing | Existing; refreshed SDK-compatible patch, existing official plugin retained |
| expo-sensors | ~57.0.3 | Device motion and sensors | Added; official config plugin; activity-recognition permission included |
| react-native-android-widget | ^0.22.1 | Android home-screen widgets | Added; official plugin plus early headless handler registration |
| react-native-notify-kit | ^10.8.1 | Full-screen incoming call notifications and foreground services | Added instead of archived Notifee; official plugin and local activity-flags plugin |

Notifee's repository was archived April 7, 2026 and recommends NotifyKit as a
maintained drop-in fork. NotifyKit supports TurboModules, uses the modern Gradle
toolchain, and builds its core from source. Do not install both libraries.
It needs JDK >=17; EAS's SDK-selected Android image supplies the toolchain.

## Configuration and integration boundaries

- App/package version is 1.1.0, Android versionCode is 2, runtimeVersion remains
  `appVersion`. Existing 1.0.0 APKs cannot receive 1.1.0 OTA bundles.
- Required location, biometric, full-screen intent, microphone, camera,
  media-projection, foreground-service, notification and boot permissions are
  declared. Dependencies contribute their own Android manifest permissions.
- NotifyKit's service declares `location|mediaPlayback|mediaProjection|microphone|camera`.
  Future callers must pass only the active `foregroundServiceTypes` subset and
  acquire the matching runtime permissions/MediaProjection consent first.
- `plugins/with-incoming-call.js` sets MainActivity `showWhenLocked` and
  `turnScreenOn`. Call UI must preserve authentication and privacy protections.
  Android 14+ full-screen intent access is still controlled by device settings;
  a manifest declaration does not grant special access.
- `src/lib/permission-rationales.ts` provides copy for future consent screens.
  Android's OS permission dialog text cannot be customized through app.json.
  No tracking, recording, screen sharing, sensor listeners or permission
  requests start as part of this foundation.
- `src/lib/maps.ts` reads `process.env.EXPO_PUBLIC_MAP_STYLE_URL`; `.env.example`
  documents it with an empty value. No fallback URL or private map key exists.
  Production EAS environment already has the Supabase public configuration;
  no map provider URL was supplied, so maps must show a configuration state
  until one is chosen. This does not block compiling the native map library.
- WebView supplies the requested preview foundation. Rendering arbitrary PDF
  files inline on Android is a later feature concern (for example a viewer in
  WebView); installing WebView alone does not implement a PDF reader.
- Router entry remains intact through custom `index.js`; it first registers
  the widget headless handler, then loads `expo-router/entry` last.
- No NotifyKit JS event handlers or service tasks are registered yet: the
  ringing feature will own those. Existing Expo notification delivery remains.

## Widgets baked into the APK

| Native name | Launcher cells | Placeholder |
| --- | --- | --- |
| UsWidget | 4 x 2 | Days together and partner status |
| PhotoWidget | 2 x 2 | Photo of the day |
| DoodleWidget | 4 x 2 | Partner's latest doodle |
| HeartbeatWidget | 1 x 1 | Heartbeat |

Placeholder renderers live in `src/features/widgets/widget-task-handler.tsx`.
They use shared theme tokens and open the app when tapped; they do not read or
send partner data. The feature remains disabled. There are no periodic refresh
jobs. Launcher allocation controls actual cell dimensions. RemoteViews are
headless native widget trees, so app React context hooks, Screen/Header and
PressableScale cannot be used in them. Feature implementation can replace the
renderers and task handler via a compatible OTA update without renaming the
four native providers.

## Validation

- Ran `npx expo prebuild --platform android --no-install` exactly once: passed.
- Asserted generated manifest permissions, NotifyKit foreground service types,
  lock-screen activity flags, and all four widget receivers; confirmed provider
  XML resources and `newArchEnabled=true` / `hermesEnabled=true`.
- Confirmed Android autolinking discovers all 14 requested/selected libraries.
- Removed only the verified, untracked generated `android/` directory. Existing
  .gitignore and .easignore exclude native directories; no native folder committed.
- `npx tsc --noEmit`: passed after fixing placeholder types.
- `npx expo export --platform android`: passed; 3,142 modules bundled.
- `npx expo-doctor`: 19/21 passed. Existing incall-manager/WebRTC have Directory
  warnings for untested New Architecture metadata. Seven existing packages have
  newer expected SDK patch releases: @expo/ui, expo, expo-dev-client, expo-router,
  expo-screen-orientation, expo-splash-screen and expo-updates. No warnings were
  suppressed and no additional native libraries were introduced to address them.
- `npx expo install --check` confirms the same seven existing patch mismatches;
  newly requested Expo dependencies match SDK recommendations.
- `git diff --check`: passed.

## Device limits, regression checklist and deployment

Compilation on the EAS Android toolchain and actual device behavior cannot be
confirmed from prebuild/TypeScript/export alone. The requested single production
APK build is submitted with `--no-wait`; no build monitoring or result claim.

Later device regression checklist: app startup and Router navigation; existing
voice/video calls and notifications; add/resize/remove each widget and cold-start
headless rendering; background location/geofence consent and off switch;
background audio; locked/unlocked incoming call presentation and Android
full-screen special access; foreground service type selection and stop action;
biometrics; screenshot blocking; sensors/battery; PDF generation/share; map
loading with an explicitly supplied public style URL.

SQL to run: none. Edge Functions to deploy: none. Manual setup steps for this
native foundation: none outstanding. Device acceptance and feature work remain
outside this task. Needs shared change: no blocking shared changes; the seven
pre-existing SDK patch updates and call-library architecture metadata merit
separate maintenance follow-up before a store release.

## Sources checked

- Expo SDK documentation: https://docs.expo.dev/versions/latest/sdk/audio/,
  location/, task-manager/, local-authentication/, screen-capture/, crypto/,
  battery/, print/, sharing/, sensors/ under the same SDK path. Installed SDK
  bundledNativeModules.json and each installed module's plugin/manifest were
  also inspected.
- MapLibre requirements/setup: https://maplibre.org/maplibre-react-native/docs/setup/getting-started/
  and https://maplibre.org/maplibre-react-native/docs/setup/expo/
- WebView setup: https://github.com/react-native-webview/react-native-webview/blob/master/docs/Getting-Started.md
- Widgets: https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-widget-expo/
  and https://github.com/sAleksovski/react-native-android-widget/blob/master/docs/docs/tutorial/register-task-handler.md
- Notifee archive/replacement guidance: https://github.com/invertase/notifee
- NotifyKit setup, architecture, full-screen and service support:
  https://github.com/marcocrupi/react-native-notify-kit

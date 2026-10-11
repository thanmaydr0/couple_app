# Us: Android development loop

Us uses Expo SDK 57, React Native 0.86, TypeScript and Expo Router. Native builds run only in EAS cloud. This laptop only runs Metro, TypeScript and JavaScript exports. Expo Go cannot run this app because WebRTC, InCall Manager, Compressor and other custom native modules require a development build.

## One-time setup before the first build

1. Replace `com.CHANGEME.us` in `app.json` with your final Android application ID. Register that exact ID in Firebase, download its Android `google-services.json`, and put the file at the repository root. It is intentionally not ignored so EAS can include it. Do not substitute a Firebase service account file.
2. Copy `.env.example` to `.env`. Set your Supabase URL and anon key. Public Expo variables are included in the app bundle; never put the Supabase service role key or Metered key here. Use the same two public variables in the EAS `development`, `preview` and `production` environments. `.env` is ignored; `.env.example` is committed.
3. Authenticate and link the real EAS project, then configure its actual update URL:

   ```powershell
   npx eas-cli@latest login
   npx eas-cli@latest init
   npx eas-cli@latest update:configure
   ```

   Review and commit the resulting `extra.eas.projectId` and `updates.url` in app config before building. No fabricated project ID or update endpoint is included in this scaffold. Keep `runtimeVersion: { "policy": "appVersion" }` and all three channels from `eas.json`.
4. Configure Firebase Cloud Messaging v1 credentials for Android push in the EAS dashboard. The service account credential belongs in EAS credentials, never in this repository or app bundle. The bundled `google-services.json` alone does not configure push delivery.

## Build APKs in the cloud

Development build (includes the development launcher):

```powershell
npx eas-cli@latest build --platform android --profile development
```

Preview build (standalone APK):

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Production APK:

```powershell
npx eas-cli@latest build --platform android --profile production
```

Open the completed EAS build link on the phone, download the APK, allow installation from that source when Android asks, and install it. The first cloud build and phone smoke test are still required to confirm native compatibility. EAS handles native project generation and compilation remotely.

## Test on a phone with Metro

Put the laptop and phone on the same Wi-Fi. Start:

```powershell
npx expo start --dev-client
```

Metro displays a QR code. Scan it on the phone and open the link in the installed Us development build. Allow Node through Windows Firewall on the private network if needed. If Wi-Fi isolation blocks the connection, use:

```powershell
npx expo start --dev-client --tunnel
```

`@expo/ngrok` is already a devDependency. The tunnel needs internet access and can be slower. Keep Metro running while testing and stop it with Ctrl+C. Feature screens currently display centered TODO labels; auth, presence and calling providers are intentional placeholders.

## Publish an OTA update

Publish to the preview build's channel with its matching environment:

```powershell
npx eas-cli@latest update --platform android --channel preview --environment preview --message "Describe this update"
```

For development or production, change both `--channel` and `--environment` to the same corresponding name. SDK 55+ requires `--environment`. Public Supabase variables must be present in that EAS environment for both build and update.

OTA updates can change compatible JavaScript and assets. Native dependency, native permission or config plugin changes require a new cloud build. With the appVersion runtime policy, increment `expo.version` before any native change and keep `package.json` version in sync; publish subsequent updates only for that new runtime. Check the update in preview on both phones before publishing it to production. Standalone builds check for updates on launch; an update downloaded in the background is normally applied on a subsequent launch. Development clients primarily load Metro; use preview to verify the installed OTA flow.

## Local checks

```powershell
npx tsc --noEmit
npx expo-doctor
npx expo export --platform android
```

The export creates a JavaScript bundle in ignored `dist/`, not an APK. Only the integration/scaffold session runs export; parallel feature sessions follow `AGENTS.md` and do not run export. App TypeScript includes `app/` and `src/`; Supabase Deno functions have a separate runtime and are not part of this compiler project.

## Installed capability notes

- All requested dependencies are installed. Extra native dependencies include worklets (Reanimated), Nitro Modules (Compressor), asset (audio), audio recording/playback, cryptographic IDs, clipboard, sharing, image manipulation, keyboard control and a seek slider. Extra JavaScript helpers include Zod, React Hook Form/resolvers and base64-arraybuffer for validated forms and binary uploads.
- Reanimated's worklets Babel transform is supplied by `babel-preset-expo`; no custom Babel configuration is needed. KeyboardProvider is mounted with preloading disabled. InCall Manager uses Android autolinking; its permissions are declared in app config. Compressor's Expo plugin is registered and its Nitro peer is a direct dependency.
- Skia's prebuilt-library postinstall is explicitly approved in `package.json` for npm's install-script policy; EAS must run dependency lifecycle scripts. No local native compilation is required.
- `expo-video-thumbnails` remains installed as requested, but is deprecated. Prefer `expo-video`'s `generateThumbnailsAsync` for new media work. No package was substituted.
- WebRTC 124.0.8 / config plugin 15.0.2 and InCall Manager 4.3.0 satisfy installed peer ranges. The plugin's published table lists SDK 56, while its peer range accepts Expo >=56. Expo Doctor marks WebRTC and InCall Manager as untested on the New Architecture. These warnings are not suppressed; native success on SDK 57 remains unverified until an EAS build and device test.
- The Supabase client uses AsyncStorage, processLock and foreground token refresh, and consumes the backend session's `Database` type without editing it. Missing env variables permit the TODO scaffold to boot with an inert placeholder configuration; future auth must check `isSupabaseConfigured` before sending requests. No database/network query is performed by the stub screens.
- Permissions in the manifest do not grant runtime access or implement an ongoing call service. Future features must request permissions when used; foreground/background calls, Bluetooth routing, media access, push delivery, orientation, drawings and movie sync need device tests.

## Sources and CLI verification

Verified `npx eas-cli@latest update --help` and `npx eas-cli@latest build --help` during scaffolding on 2026-10-11. The documented `--platform`, `--profile`, `--channel`, `--environment` and `--message` flags come from those commands.

- [Expo SDK reference](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Router installation](https://docs.expo.dev/router/installation/)
- [Reanimated setup](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/)
- [Video and thumbnails](https://docs.expo.dev/versions/v57.0.0/sdk/video/)
- [Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
- [Media Library](https://docs.expo.dev/versions/v57.0.0/sdk/media-library/)
- [Updates](https://docs.expo.dev/versions/v57.0.0/sdk/updates/)
- [WebRTC Expo plugin](https://github.com/expo/config-plugins/tree/main/packages/react-native-webrtc)
- [InCall Manager](https://github.com/react-native-webrtc/react-native-incall-manager)
- [Compressor](https://github.com/numandev1/react-native-compressor)
- [Supabase React Native setup](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [TanStack Query on React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)
- [Keyboard controller installation](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/installation)

The remaining Expo packages were checked against their SDK 57 documentation, and the JavaScript/native helpers against the installed package READMEs and peer dependencies. `package-lock.json` records the resolved versions. Do not install dependencies during later feature waves.

## Scaffold verification results

- `npx tsc --noEmit`: passed, including the typed Supabase client.
- `npx expo config --type public`: passed; config plugins resolve.
- `npx expo install --check`: passed after installing the audio asset peer.
- `npm ls --depth=0`: passed, with no missing or invalid direct dependencies.
- `npx expo-doctor`: run once, 19/21 checks passed. It identified the missing `expo-asset` direct dependency (subsequently installed and checked) and the two New Architecture metadata warnings described above. Doctor was not rerun or its warnings suppressed.
- `npx expo export --platform android`: passed. It warns that `google-services.json` is absent; the actual Firebase file is a manual prerequisite for EAS, not a file this scaffold can fabricate.
- npm audit reports 34 dependency advisories (13 moderate, 21 high), largely inherited through the Expo/React Native toolchain and ngrok dependencies. Its proposed changes include incompatible SDK downgrades/upgrades, so no forced audit changes were applied. Review compatible upstream fixes during a shared dependency maintenance task before release.
- No local native build, device test, authenticated Supabase request, EAS cloud build or OTA publish was performed. Real project credentials, EAS linking and Firebase configuration are still required.

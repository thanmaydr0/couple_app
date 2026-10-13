# Privacy basics

Owned implementation: `src/features/applock/**`, existing `app/us/applock.tsx`
re-export, and `supabase/migrations/330_applock.sql`. No dependencies or native
folders were changed. The enabled registry SettingsSection links Settings to Privacy.

## Behavior

- Device-local SecureStore policy defaults to Off. Immediately / 30 seconds /
  1 minute / 5 minutes apply to time spent away. Every cold start locks when on.
- Bootstrap never mounts protected children until policy hydration and required
  authentication finish. Failed storage reads remain covered with a retry action.
- Android biometrics use `disableDeviceFallback: false`, allowing the system's
  PIN, pattern or password fallback, including devices without enrolled biometrics.
  Enabling, disabling or changing the policy requires successful authentication.
- Background and loss of focus cover content immediately, before the grace period
  expires. Resume computes expiry before clearing the cover. System biometric
  focus changes do not restart the timer, but actual background events still do.
- A native Modal covers the navigator and route modals; underlying content stays
  mounted after first unlock but is hidden from input and accessibility while covered.
- Android FLAG_SECURE stays set whenever lock is on, because a background-only JS
  call can arrive after the recents snapshot. Consequently screenshots and recordings
  are also blocked in the foreground while app lock is on. The screen explains this.
- Unlock fade and decoration respect the shared motion preference. No unlock
  success is persisted across processes.
- `profiles.privacy.hide_message_previews` and `block_screenshots` default to false.
  Atomic invoker RPC merges just the chosen boolean, retaining other feature keys.
  Existing profile RLS plus the caller's couple constrain the update. No new table,
  column, realtime subscription or publication change is needed.
- Per-user cached preferences support offline reads; offline saves are disabled.
  Failed saves do not optimistically claim success. Lock changes remain local/offline.

## Secure screens

Import `useSecureScreen` from `@/features/applock/useSecureScreen`.
Call `const secure = useSecureScreen(visible)` unconditionally, and render private
content **and create/show its native Modal only when `secure.ready` is true**.
If `secure.error` is present, keep content hidden and offer dismissal/retry.
Android RN Modals inherit the Activity secure flag when their dialog is created;
showing the dialog before acquisition finishes can leave it unprotected.

Each hook instance uses a separate native protection key. Serialized acquisition /
release calls prevent a late cleanup clearing a new owner's protection. Until a
preference can be resolved, private screens conservatively wait for protection.
An explicit saved false permits capture unless app lock or another owner blocks it.

## Deployment and verification

Migration 330 was applied to the project matching `.env`, `tlqedvktbgaipzhdgsuy`.
Prerequisites: `001_init.sql`, then `100_infra.sql`, then `330_applock.sql`.
No Edge Function belongs to this feature or needs deploying for these settings.

Live transactional verification ran as `authenticated`, updated both flags,
checked preservation of other JSON keys and rejection of unknown settings, then
rolled back all preference writes. RLS, invoker mode and function ACLs were checked;
anon cannot execute the RPC. The security advisor reported no applock findings.

Run `node src/features/applock/verify.cjs` for policy boundaries, the actual gate's
hydration/authentication/background/focus logic, ordered capture calls, and secure
screen acquisition/readiness across preference changes. This uses mocked native
APIs and does not substitute for Android device testing.

`npx expo-doctor`: 19/21 checks passed. Existing shared dependency patch mismatches
and React Native Directory warnings remain; no packages were installed or changed.
No connected Android device was reported by `adb devices`. Native biometrics/PIN,
recents snapshots, screenshot/recording prevention, native modal focus/layering,
AA contrast at enlarged text sizes and frame-by-frame resume need a device.
JavaScript lifecycle handling alone cannot prove a zero-frame reveal under a
stalled JS thread; a strict platform-level guarantee needs a native lifecycle cover.

## Regression checklist

- Off installs show no authentication prompt; all four on policies lock cold starts.
- Return just below / at / above each threshold, including a frozen/background JS
  thread, Android notification shade, deep links and already-open route modals.
- Cancel/fail biometrics, PIN-only device, biometric lockout, correct PIN/pattern,
  background during the prompt/fade, process kill and SecureStore failure.
- Recents is blank; screenshots/recordings fail while lock is on; unlock preserves
  navigation; disabling releases only the app-lock capture key.
- Private-area hook holds content/Modal until ready, respects opt-out, survives
  concurrent owners and failed acquisition, and releases on unmount.
- Online flag save persists per recipient; offline shows cached state and cannot
  claim a save; the partner cannot update this user's settings.
- Full/Reduced/Off motion, TalkBack focus, large fonts and 48dp controls.

## Needs shared change

1. E2EE/chat: replace the view-once stub call in `src/features/chat/ViewOncePhoto.tsx`
   with the one-line call `const secure = useSecureScreen(!!url);` (import from
   `@/features/applock/useSecureScreen`). Then gate Modal visibility and image
   rendering on `secure.ready` and surface `secure.error`; do not create a visible
   dialog before native protection is ready. Remove/update the old “Screenshots
   are not blocked yet” explanation. Chat was not edited in this session.
2. E2EE/notify-partner: read the **recipient's** `profiles.privacy` on the server.
   If `hide_message_previews === true`, send a generic title/body (for example
   “Us” / “New message”) and remove message text/media URLs from notification data.
   Retain only routing/opaque identifiers. Missing flag means false; if recipient
   privacy lookup fails, use generic text rather than leaking a preview. Apply to
   each message-notification path before delivering through Expo/FCM. This session
   did not edit or deploy notify-partner.
3. Shared root: the existing AppLockGate is **inside** CallProvider/AuthGate and
   DevLabEntry is its sibling. Their independent native call modal / auth overlay
   / lab control are not protected descendants. Place those UI surfaces beneath
   the gate or make their owners explicitly honor the lock before showing a native
   modal. A native lifecycle cover is also needed if a formal zero-frame guarantee
   is required under JS stalls. Root and native folders were not edited.
4. Shared package maintenance: resolve Expo Doctor's seven patch-version
   mismatches and existing incall-manager / WebRTC New Architecture metadata
   warnings in the dedicated dependency session.

No manual setup is assigned to the user. Deployment and automated verification
were completed here; the shared integrations above remain with their owning sessions.

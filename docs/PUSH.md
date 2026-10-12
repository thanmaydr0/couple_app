# Android push notifications

Us registers an Expo push token after login and on startup, app resume, and
native token rotation. Android channels are `messages` (default importance) and
`calls` (maximum importance, sound and vibration). A friendly explanation appears
before the Android notification permission prompt. Choosing Not now is remembered;
Settings → Test notification lets you try again. If Android blocks further prompts,
the app offers Open settings.

The token is upserted by `user_id` in `push_tokens`. Live RLS was verified to allow
only the owner to select, insert, update and delete their row. Sign-out removes
this device's token before ending the session (without deleting a replacement
registered by another phone). This schema supports one device per user:
the most recently registered device receives pushes.

## Delivery setup and status

- EAS project: `9ed6b019-a224-484f-9d5c-f5c6e7e3ec11`, account `thanmaydr`, app `us-app`.
- Android package: `com.thanmay.teser`; Firebase project: `teser-278d0`.
- `google-services.json`, the notifications config plugin, Android permission,
  and required JavaScript packages already exist. No native folders were edited.
- The JWT-protected `notify-partner` Edge Function was updated on the existing
  Supabase project. It derives the recipient from verified couple membership.
  A `test` request always targets the authenticated caller, ignoring supplied
  recipient IDs. Normal sends never reveal whether the partner has a token.
- **Configured on 2026-10-12:** the dedicated service account
  `us-expo-push@teser-278d0.iam.gserviceaccount.com` has Firebase Cloud Messaging
  API Admin (`roles/firebasecloudmessaging.admin`) access. Its approved JSON key
  is assigned to `com.thanmay.teser` for FCM V1 in Expo. The key is kept outside
  the app and Git in the current Windows user's restricted private folder.
  `google-services.json` is a different, public client configuration file.
  Expo accepted remote self-test sends for both accounts after configuration;
  actual phone display still needs device verification.

See [Expo's FCM V1 setup guide](https://docs.expo.dev/push-notifications/fcm-credentials/).
Use an Android development or release build on a physical phone; Expo Go does not
support this remote push workflow. A new EAS cloud build includes the updated
default channel config. No local native build is needed.

## Foreground and tap behavior

- Message notifications are silent and hidden while Chat is open. When Chat is
  elsewhere, a message whose server read receipt is already set is also hidden.
  The receipt lookup has a 1.2-second deadline; on network failure the banner is
  shown. Existing chat read receipts represent messages loaded while Chat is open.
- Call notifications are presented even while Chat is open. Foreground receipt
  also asks the existing call engine to recover a live incoming call.
- A message tap opens Chat. A call tap queries the exact call with RLS and checks
  the partner, couple, ringing status and server start time. Only invites younger
  than 40 seconds open the existing incoming-call flow. Expired/cancelled/missing
  calls open Home with a “Missed call” toast. Network failures offer a retry.
- Taps wait for authentication, navigation and call engine readiness. Both warm
  and cold starts are handled, and completed taps are cleared to prevent replay.
  Supplied URLs are never followed; notifications for another recipient/couple
  are ignored.
- Chat sends and call invites invoke `notify-partner`; the server sets routing
  type and recipient itself. Call pushes expire after 40 seconds in transit.
  Failed push delivery never changes a successful message into a failed bubble.

## Make notifications reliable

On **each phone**, open Android Settings → Apps → Us:

1. Allow notifications, including both Messages and Incoming calls. Allow sound,
   vibration, lock-screen display and pop-ups for Incoming calls if available.
   Android may use different names; an existing channel's importance is controlled
   by the user and cannot be raised by the app after creation.
2. Under Battery/App battery usage, select **Unrestricted**, **Don't optimize**,
   or **No restrictions**. Disable battery optimization for Us. Allow background
   activity and background data; exempt Us from Data Saver if you use it.
3. Enable **Autostart/Auto-launch** wherever your vendor offers it:

   | Vendor | Settings to look for (names vary with Android version) |
   | --- | --- |
   | Xiaomi/Redmi/POCO | Apps → Permissions → Background autostart; Battery saver → No restrictions. |
   | Oppo/Realme | App management → Us → Battery usage → Allow auto-launch/background activity. |
   | Vivo/iQOO | Apps → Special app access/Permission management → Autostart; allow high background power usage. |
   | OnePlus | Apps → Auto launch if available; Us → Battery usage → Allow background activity/unrestricted use. |
   | Samsung | Battery → Background usage limits → Never auto sleeping apps → add Us; remove it from Sleeping/Deep sleeping apps. Most Samsung versions have no separate autostart switch. |

4. Optionally lock Us in Recents if your vendor supports that. Turn off Do Not
   Disturb for testing, or allow the relevant notification channels.
5. Reopen Us after changing these settings, sign in, and use Settings →
   **Test notification**. It sends a real remote Expo push to your own saved token,
   rather than a locally scheduled notification. “Accepted” means Expo accepted
   the request; it does not prove the phone displayed it.

### Closing the app is not the same as Force stop

Swiping Us away from Recents normally still permits Android to display a remote
notification, but battery saving and Xiaomi/Oppo/Vivo/OnePlus/Samsung vendor
restrictions can delay or block delivery. These settings improve reliability;
they do not guarantee it. Android **Force stop** (Settings → Apps → Us → Force
stop) prevents push delivery until you manually open Us again. Reopen once after
installation/reboot if necessary. Offline phones cannot receive a live call
within its 40-second window.

A closed app receives an ordinary call notification. Tapping it opens Us and the
incoming-call flow; this implementation does not promise automatic full-screen
lock-screen call UI or a JavaScript ringtone while the process is dead.

See [Expo notification troubleshooting](https://docs.expo.dev/push-notifications/faq/)
and [Android background limits](https://developer.android.com/develop/background-work/background-tasks/bg-work-restrictions).

## Verification checklist

Automated checks: `npx tsc --noEmit`, `npx expo-doctor`, and
`node --test src/features/notifications/*.test.cjs src/features/calls/engine.test.cjs src/features/chat/verify.mjs`.
Doctor currently reports the existing New Architecture metadata warning for
`react-native-incall-manager` and `react-native-webrtc`; it is not suppressed.
Live checks on 2026-10-12 confirmed owner-only token reads for both accounts and
missing-JWT rejection. Initial self-test sends returned HTTP 502 before FCM V1
setup; after configuration both remote self-tests were accepted by Expo.
Phone display is not verified. The live check
can be repeated with `node src/features/notifications/live-check.cjs` using the
existing ignored local account credentials; it sends one self-test per account.

On two physical phones with the updated app and FCM credential configured:

1. Login → explanation → Allow; verify a token is saved. Deny once, then retry
   through Settings. Reopen/resume the app and test again.
2. Send text and a photo while the partner is on Home/backgrounded; tap → Chat.
   Send while the partner has Chat open → no banner/sound. Leave Chat after
   reading, then verify a delayed push for that message remains hidden.
3. Invite a call while Chat is open → call notification and incoming UI. On a
   backgrounded phone, tap before 40 seconds → incoming flow. Tap after 40
   seconds or cancellation → Home + Missed call. Repeat from a cold launch.
4. Sign out, then test from the partner: the signed-out phone must not receive
   newly sent notifications. Switch accounts and verify stale taps are ignored.
5. Test with screen locked, normal Recents dismissal, battery saver, and vendor
   settings. After Force stop, manually reopen before expecting notifications.

Visual display, actual delivery, native permission dialogs, vibration, lock-screen
behavior, and manufacturer power settings require physical-device verification.

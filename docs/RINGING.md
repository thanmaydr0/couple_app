# Android ringing, screen sharing and Goodnight calls

Status, 13 October 2026: feature code is implemented and the database migration and push function are deployed. **Cold-start notification actions and screen capture still require the shared integration below. They are not device-verified or ready to claim as working end to end.** No native build, dependency installation, or hand edit of generated native files was performed.

## Research and implementation choices

- [Android 14 foreground-service types](https://developer.android.com/about/versions/14/changes/fgs-types-required): ongoing calls use `microphone`, plus `camera` for video, started after runtime permission while the activity is visible. Camera transmission retains the existing privacy pause in background. Do not use `phoneCall` without its Telecom/ConnectionService prerequisites.
- [Full-screen-intent rules](https://developer.android.com/about/versions/14/behavior-changes-14#secure-fsi): request full-screen presentation only for an incoming call, with a high-importance CALL notification. Permission does not guarantee full-screen presentation; an unlocked device may show a heads-up notification. Existing app config declares USE_FULL_SCREEN_INTENT and its lock-screen activity plugin.
- [Expo headless pushes](https://docs.expo.dev/push-notifications/what-you-need-to-know/) and [notification tasks](https://docs.expo.dev/versions/latest/sdk/notifications/): send high-priority data only, no display title/body or `data.title`/`data.message`, and define the task at module scope. Expo/Android can delay or discard background delivery. Force-stop is different from swiping away: a force-stopped app cannot promise incoming calls until reopened.
- [NotifyKit documentation and config plugin](https://github.com/marcocrupi/react-native-notify-kit): installed version 10.8.1 supports fullScreenAction, call category, looping sound, timeoutAfter, notification actions, foreground service types, settings checks and OEM settings links. Use a dedicated `incoming-calls-v1` channel so an existing low-importance channel does not silently inherit unsuitable settings. Sound is the device default notification tone, looped; choosing an actual call ringtone/custom raw sound remains a shared sound-resource configuration task.
- [WebRTC screen capture](https://react-native-webrtc.github.io/handbook/guides/basic-usage.html#getting-a-media-stream-using-getdisplaymedia): use the installed API's `getDisplayMedia({})`, not browser-only video/audio constraints. Installed Android source confirms its MediaProjection service starts after consent, but is disabled unless `WebRTCModuleOptions.enableMediaProjectionService` is enabled. A declarative config plugin is supplied inside ringing; capture remains gated until it is registered in app config and a new Android binary is built.
- Calls reuse the existing RLS-protected row as the durable invite. Callee recovery reads a fresh ringing row, subscribes, and sends `ready`. Ready does not imply answer consent: the caller checks durable `answered` status before offering. Repeated ready resends an outstanding offer. Legacy invite/accept broadcasts remain supported. No SDP, ICE addresses or media are stored in SQL.
- Screen share reserves a separate video transceiver during initial negotiation. Replace its track, leaving microphone and camera intact; signal its negotiated MID to identify the receiver track. No competing offer makers. Screen view uses contain plus direct pinch zoom; camera remains selectable. System capture stop, app Stop and call cleanup release capture.
- Goodnight is opt-in from an audio call. Sender parameters cap audio at 20,000 bits/s; actual network use includes headers, ICE, retransmissions and codec behavior. Ambient beds are generated locally by `node scripts/make-ambient.mjs`, original deterministic 16 kHz mono WAVs, eight seconds each. Expo Audio mixes locally; audio is not injected into WebRTC. Sleep choices are 30/60/120 minutes or explicit “I'm asleep” confirmation from both participants, not sleep detection. Final 30 seconds fade ambient volume; the call then ends. Wall-clock deadlines are rechecked on resume; exact execution while Android suspends/kills JS is not guaranteed.
- Nightly “Goodnight call?” suggestions are local daily notifications, off until explicitly enabled, with configurable HH:MM and a Disable button. Pulse's existing exported `setAvailability('sleeping')` helper is used; its failure does not end the call.

## Needs shared change before device release

These are outside this session's allowed paths and were deliberately not edited.

1. **Shared Android entry and notification dispatcher:** load `src/features/ringing/headless.ts` before `expo-router/entry`. NotifyKit has ONE background handler and ONE service runner. Location currently registers both in `src/features/location/runtime.ts`; its late registration overwrites a call handler. Refactor those registrations into exported handlers and install one dispatcher, using `installRingingHeadless({onEvent, runService})` with location's handlers as the fallbacks. Keep those fallbacks from registering again later. No-op fallbacks are suitable only if location is disabled. Coordinate foreground-service lifetime/types for simultaneous location and calls; calls currently avoid starting over an already visible location-controls notification. A location session started during a call also requires shared ownership coordination. Cold Decline/Hang up/Stop cannot be marked complete until this is wired.
2. **App config:** register `./src/features/ringing/with-media-projection.cjs`. It enables WebRTC's own service in MainApplication through prebuild and declares the capability in Expo extra. Use the project's cloud Android build workflow; no local native build. The existing permissions and NotifyKit microphone/camera/mediaProjection service declarations are already present. A newly configured binary is required; OTA alone cannot enable this native option.
3. **Settings:** add a shared Settings row linking to `/call?health=1`. The health screen already exists and is available from Calls → Ringing health check; no new route is needed.
4. **Sound resources, if a call ringtone is required:** register a bundled ringtone with the Expo Notifications sounds config and select it on a new channel. Current channel uses the looped device notification tone. Android cannot programmatically upgrade a channel the user has muted or changed.
5. Feature-local reusable UI candidates: `ScreenShareView`, `GoodnightScreen`, and `RingingHealthScreen` remain in their owned folders and use shared UI/theme tokens.

## Android 14+ sideloaded full-screen permission

The health screen checks notification authorization, full-screen-intent availability, battery optimization, and call-channel importance/blocking. It opens relevant settings and refreshes when you return. OEM autostart and global lock-screen visibility require visual inspection; the UI does not claim to read settings that the APIs do not expose.

On common Android builds: Settings → Apps → Special app access → Full-screen notifications (sometimes “Full-screen intents”) → Us → Allow. Search Settings for “full screen” if the label differs. Grant ordinary notifications separately: Settings → Apps → Us → Notifications → Allow notifications. On Android 13+, that permission must be granted. Full-screen access can be absent on sideloads even when declared in the manifest.

Incoming calls channel: Settings → Apps → Us → Notifications → Incoming calls. Enable it, choose Alerting/high importance, sound and vibration, and show on lock screen. Some phones call the high-importance toggle “Pop on screen”, “Banners” or “Floating notifications”. Global Settings → Notifications → Lock-screen notifications must allow notifications/content. Caller names are visible on the public call notification; choose lock-screen privacy accordingly. Do Not Disturb can suppress sound; the app does not bypass DND.

## Battery and autostart by brand

Paths depend on Android version, firmware, country and carrier. Use health-check shortcuts first; unavailable OEM settings are reported rather than guessed.

| Phone family | Relevant settings |
|---|---|
| Pixel / AOSP | App info → App battery usage → Allow background usage / Unrestricted, where offered. Keep notifications enabled and avoid force-stop. |
| Samsung One UI | Settings → Battery (or Battery and device care) → Background usage limits → Never sleeping apps / Never auto sleeping apps → add Us. Remove it from Sleeping/Deep sleeping apps. [Samsung guidance](https://developer.samsung.com/mobile/app-management.html). |
| Xiaomi / Redmi / POCO | Settings → Apps → Permissions → Background autostart → Us. Battery saver for Us → No restrictions, where offered. [Xiaomi autostart guidance](https://www.mi.com/global/support/faq/details/KA-497677/). |
| OPPO / realme / OnePlus | Use App info battery controls to allow background activity, and Auto-launch/Startup Manager when the firmware offers it. These brands do not share one reliable settings path; use the detected OEM shortcut or Settings search. Power saving can delay notifications. [OPPO guidance](https://support.oppo.com/sa-en/answer/?aid=neu135). |
| vivo / iQOO | Look in Apps → Special app access → Autostart and Battery → Background power consumption management; available controls vary. [vivo manual](https://asia-exstatic-vivofs.vivo.com/PSee2l50xoirPK7y/1727424675246/a2d6a31198407f8dcca15154c49be848.pdf). |
| Huawei / older Honor EMUI | Settings/Phone Manager → App launch → Us → Manage manually → Auto-launch, Secondary launch and Run in background. [Huawei guidance](https://consumer.huawei.com/en/support/content/en-us15850065/). Google FCM/Expo delivery additionally requires compatible Google services; these switches cannot supply missing push transport. |

Manufacturer process killing, power saving, DND, connectivity, force-stop, Google services availability and user channel choices remain outside app control. No implementation can promise ringing on every phone state.

## Backend and verification completed

- Project `tlqedvktbgaipzhdgsuy`: migration `360_ringing.sql` applied as remote migration `ringing`. Existing calls RLS retained; pending-call index and private-channel policies present, calls included in supabase_realtime. Live SQL readback confirmed RLS, publication membership and index.
- `notify-partner` deployed, version 9, gateway JWT verification retained. The function also validates the user token and derives membership, recipient, caller name, kind and expiry server-side. Stale/terminal/foreign calls cannot produce a call push through this path. No new secrets required. No partner notification was sent as a test.
- TypeScript run with no errors in owned folders. Other sessions' errors, if present, are not modified.
- Node suite: 21 tests pass, covering existing call lifecycle, ready consent/replay, separate screen sender cleanup, Goodnight bitrate, server-derived data-only push and stale invite rejection.
- Expo Doctor run once: 19/21 passed; existing React Native Directory New Architecture warnings for incall-manager/WebRTC and seven Expo patch-version mismatches. No packages changed.
- ADB: no connected device. No audio routing, full-screen display, real push delivery, actual MediaProjection capture, background service survival, Opus bitrate, ambient mixing or OEM behavior was verified on hardware. Settings integration and shared headless ownership remain incomplete as listed above.

## Regression checklist for a two-phone Android test

- Voice: caller/callee audio both directions, mute/unmute, speaker/earpiece/wired/Bluetooth; decline, cancel, 40-second missed call, busy/simultaneous calls; repeated calls release microphone and notifications.
- Video: both cameras, flip, camera toggle, background privacy pause/resume; ordinary calls work without entering Goodnight or screen share.
- Recovery: delay opening a fresh notification, accept after cold launch, drop invite/accept/offer broadcasts, and reconnect signaling. Ready never answers without consent. Stale/ended call notifications never revive calls.
- Ringing: foreground, background, swipe-away, locked screen, reboot-after-launch, Doze, permission denied, channel muted, DND, battery saver. Distinguish force-stop from ordinary process death. Test Accept and Decline on lock screen after shared wiring; Decline must not open the call UI.
- Service: lock phone mid-call, verify microphone continuity and persistent On a call notification; Hang up from notification releases microphone/camera. Test interaction with location sharing after shared service coordination.
- Screen: consent granted/denied, caller shares, callee shares, both share, camera remains selectable, pinch zoom, app Stop, notification Stop, Android capture Stop and call-end cleanup. Test Android 14/15+ and permission re-prompt on every new capture.
- Goodnight: cap via sender stats/network measurements, ambient off by default, each loop/crossfade, volume, headset routing, no remote ambient injection, each timer and fade, both explicit confirmations, network interruption and resume past deadline.
- Reminder: chosen local time, timezone/DST change, enable/disable/re-enable without duplicates, sign-out behavior. Scheduled local reminders are device-level and survive sign-out until disabled; account-wide notification cleanup is a shared lifecycle concern.

No user-side SQL or function deployment remains. Device steps above are a validation guide; this session could not execute them because no phone was connected. Shared file changes were not made because AGENTS.md makes those files read-only during this wave.

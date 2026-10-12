# Two Android phones (about 10 minutes)

Use an existing Android **development build** with the installed WebRTC and
incall-manager modules, not Expo Go. Sign into one paired account on each phone.
Open `/call` (for a standalone build, `us://call`). On both phones tap **Enable
call notifications** and allow notifications. No backend setup remains on the
current project: the call broadcast policies were deployed and checked.

1. **Voice:** A calls B. Check caller ringback and B's full-screen incoming screen,
   ringtone/vibration, accept/decline. Accept: hear both ways, timer increments,
   avatar is visible, video buttons are absent. Mute/unmute each side. Switch
   speaker/earpiece, plug/unplug a wired headset, pair/connect Bluetooth and
   select it under Audio output. Allow Nearby devices when asked. End from each
   side; both UIs close and audio/ringtone stop. Repeat with accounts reversed.
2. **Video:** allow microphone/camera only at start/accept. Check remote video
   fills the screen, local preview drags within bounds, flip camera and camera
   on/off work. Rotate each phone. Toggle mute/camera while connecting and verify
   the resulting tracks respect those choices. End; camera indicator disappears.
3. **Permissions:** revoke microphone/camera; deny first, retry, then permanently
   deny. Check the explanation and Open settings fallback. No caller invite/media
   starts after denial. Declining permission on acceptance declines the invite.
4. **Unanswered/cancel:** leave ringing for 40 seconds; both return to idle and
   history says missed. Cancel while ringing, while B's permission prompt is open,
   and while connecting. No late media acquisition should resurrect the call.
5. **Collision/busy:** tap call simultaneously on both phones. The lower UUID
   remains caller; the other shows its incoming screen. Test twice with reversed
   tap order. For a busy response, use a second signed-in instance of a partner
   account to invite a phone already connected; its current call must continue.
6. **Network:** put one phone on Wi-Fi and the other on mobile data. Debug builds
   show selected ICE pair `direct` or `relay`; verify relay on a network that
   requires TURN. Toggle airplane mode briefly; see Reconnecting… then recovery
   with only the original caller producing restart offers. Leave disconnected
   for 30 seconds; the call should end with a useful error.
7. **Push/cold start:** close B normally (do not Force stop), call from A, and tap
   the notification within 40 seconds. B restores the ringing incoming screen
   from history. Repeat but tap after 40 seconds or after A cancels: no incoming
   screen. Verify a real push reaches a registered physical device; a successful
   function response alone does not establish delivery.
8. **Background:** during a connected call press Home/lock the screen. Audio is
   kept running while the process survives; video pauses in background and resumes
   on return if enabled. Test your actual Android version and battery settings.
   Force stop/process kill ends the ability to continue this WebRTC call.
9. **History:** refresh `/call`; check ringing → answered → ended with duration,
   declined and missed. Tap a history row to call back with the same kind. Sign out
   during a call: local capture stops and another account's history is not shown.

## Limits to verify, not guarantees

There is no native foreground call service or Android Telecom/CallKeep integration
in the installed feature. Permission declarations alone do not create a service.
Modern Android may suspend or kill background microphone/camera/JS, especially
under battery restrictions. A full-screen incoming UI appears **inside the open
app**; a closed app gets a regular high-priority notification which must be tapped.
This cannot guarantee lock-screen full-screen intents, incoming calls after Force
stop, or ongoing calls after process death. Native service/integration changes
belong in a separate shared configuration task; do not hand-edit native folders.

## Checks already run without devices

- `npx tsc --noEmit`: passed after implementation.
- `node --test src/features/calls/engine.test.cjs`: lifecycle/race tests passed.
- `node src/features/calls/live-check.cjs`: both accounts authenticated, four TURN
  relay entries per account, all nine private broadcast events plus reverse
  delivery, foreign channel denial, guarded history transitions, cross-couple
  write denial, and `notify-partner` type `call` accepted. Test history removed.
- `npx expo-doctor`: 20/21 passed; React Native Directory labels
  react-native-webrtc/react-native-incall-manager untested on New Architecture.
- Native media, device push delivery, permissions, routing, layout, and Android
  process behavior require the phones above. No local native build was run.

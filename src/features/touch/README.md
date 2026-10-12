# Touch Together

Implemented within `src/features/touch/**`; the existing `/us/touch` route already exports this screen. No dependencies, native folders, shared files, migrations, or Edge Functions were changed.

## Experience

- Invite through `notify-partner` with channel `pulse` and route `/us/touch`, or join directly. Persisted per-user one-minute invite cooldown, including failed attempts; invitations never claim device delivery.
- Explicit room entry enables ephemeral sharing. Private `touch:<couple_id>` presence uses the authenticated profile and partner IDs. No touch data is stored. Leave, Android back, background, network loss, and unmount release contact and remove the room.
- Dark Skia canvas, normalized coordinates, movement coalescing at a minimum 67ms interval, release messages without coordinates, bounded trails, ripples, bloom particles, and double-tap hearts. One finger per device is intentionally tracked. Peer instance selection and a ready handshake prevent first-touch loss and reject old room packets.
- Partner samples interpolate with bounded 100ms extrapolation. Active rendering is 30fps Full / 15fps Reduced and Off; idle polling uses the shared slow motion token. Background stops rendering. Reduced and Off show simple orbs without trails, bloom particles, or breathing animation.
- The lower sorted profile ID coordinates pulses. Both peers exchange ping/pong timestamps every two seconds, use the lowest-RTT sample to estimate clock offset, and schedule double haptics 350ms ahead about once per second during contact. A two-second calibration window prevents the first pulse preceding peer clock readiness. Haptics default OFF; gentle and strong settings apply to room pulses. Reduced/Off suppress room haptics. Timing is best effort, and pulses are suppressed when RTT exceeds the scheduling window; Android hardware cannot guarantee exact simultaneous physical vibration.
- Accumulated actual contact duration stops on separation; leaving shows a summary and the shared Burst. A 30-minute wall-clock room cap disconnects streaming until Continue. Portrait orientation and keep-awake are scoped to an active foreground room and restored on exit/pause.

## Verification performed

`node src/features/touch/verify.cjs` runs the actual hook in a deterministic two-client transport with fake native APIs and clocks. It checks private room configuration, no broadcasts while alone, the join handshake, matched pulse timestamps and double pulses, <=15 coordinate packets/second, no stationary coordinate traffic, release, sender validation, same-location hearts, background silence, cap, persistent invitation cooldown, disabled/reduced haptics, stale transport, partner departure, and timer cleanup. This is a simulation, not a physical-device result.

`npx tsc --noEmit` (using the installed compiler via `--no-install`) and one Expo Doctor run were performed. See the automation report for their current results.

Live Supabase inspection confirmed the configured project is `tlqedvktbgaipzhdgsuy`, `notify-partner` is ACTIVE, and the deployed `realtime.messages` policies cover calls, presence, scribble, and watch only. There are no Touch policies. No SQL was run to change backend state.

`adb devices -l` returned no devices. No native build or Expo export was run.

## Needs shared change — release blocker

The shared backend owner must authorize SELECT and INSERT on `realtime.messages` for authenticated users with `extension` restricted to `broadcast`/`presence` and exact topic equality `touch:` plus `my_couple_id()`. Private channel authorization is required for both extensions. Currently room subscription is expected to fail safely, with an authorization/retry message. The user explicitly assigned this session **No SQL**, so no policy file was created or deployed. Never switch this feature to public channels to work around this blocker.

Expo Doctor also reported existing patch-version mismatches (Expo, Expo UI, dev client, router, orientation, splash, updates) and untested New Architecture metadata for incall-manager/webrtc. Dependency updates belong to N0/shared work, outside this session.

No new shared UI component is required. No SQL migration or new Edge Function deployment belongs to this feature session.

## Deferred two-phone regression checklist

These checks require the policy above and two paired Android devices with the existing development client. No user setup is requested by this automation; the checks remain unverified until that environment is available.

1. Open Touch on A, invite B, confirm one notification opens `/us/touch`; join on B. Repeat invite within one minute, including after remount; confirm cooldown. Turn off network during invitation and verify the inline error and direct-join option.
2. Wait on A alone; confirm breathing glow only in Full. Join B; hold both at the same normalized point on different-size screens. Check distinct user colors when different theme accents are selected, trails, merged orb, bloom, duration, and double haptics after enabling gentle/strong on both.
3. Hold still for at least ten seconds; inspect transport logs externally to confirm no repeated coordinate messages. Drag rapidly; confirm <=15 touch messages/second. Double-tap near an edge; confirm B receives a heart at the same normalized location. Long holds must not trigger tap hearts.
4. Separate, release, cancel the gesture, use a second finger, background either device, lock the phone, disconnect Wi-Fi, and return. Confirm the counter stops, stale orbs clear, pulses stop, waiting/reconnecting appears, and reconnecting never revives an old touch without a new gesture.
5. Enable Reduced and Off, including Android system Reduce Motion. Verify simple circles with no trails/particles/breathing or room haptics. Switch light/dark themes, large text, and TalkBack; check controls >=48dp and readable status labels.
6. Attempt rotation and navigate back. Verify portrait locking, normalized layout recovery if lock is unavailable, keep-awake only in active room, and previous orientation restored after exit. Leave by screen button and Android back; check summary and Full-only Burst.
7. After 30 minutes verify no stream continues until explicit Continue. Verify Continue rejoins, Leave ends, idle battery usage drops, and no timers/presence remain after leaving.
8. Attempt the private room with an unrelated authenticated account; membership RLS must deny subscription. Verify notification permissions/tokens and actual Android delivery on both phones.

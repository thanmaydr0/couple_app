# Calls

`CallProvider` is already mounted in the root layout. It owns a couple-scoped
engine and displays an in-app full-screen native Modal for incoming, outgoing,
connecting, connected, and reconnecting states. Navigating away from `/call`
does not own or interrupt the media lifecycle. Errors are surfaced globally.

The provider subscribes to **private** `call:<couple_id>` Realtime broadcast with
server acknowledgement. Every envelope checks partner ID, recipient, couple,
call ID and media kind. SDP/ICE are only sent over that channel; early ICE is
queued until remote description is set. Only the original caller creates offers,
including restarts. Duplicate accept/offer traffic is safe; outstanding offers
are resent to recover lost negotiation messages. Reconnection is bounded to 30s.
Simultaneous outgoing invites use lexicographic UUID order: lower user ID wins.

History is durable in the existing `calls` schema. Ringing lasts at most 40s;
fresh ringing history repairs push cold starts and missed broadcasts. Terminal
status updates are guarded so delayed acceptance cannot revive a cancelled row.
Expired ringing rows are reconciled to missed when either member is online.
Cancellation uses `ended` (the schema has no cancelled status), busy uses
`declined`, and a missed invite uses `missed`. History durations use answer/end
timestamps; the live timer starts at media connection. The four-second scoped
recovery poll also detects a lost terminal broadcast. Process death during an
answered call cannot resume media; its history may need server-side reconciliation
in a future heartbeat/lease design.

TURN credentials are fetched by the existing shared client invoking
`turn-credentials`, cached in memory for 60s per user and cleared on teardown.
The function's array response and an `iceServers` wrapper are accepted. Failure
uses public Google/Cloudflare STUN. Logs never print credentials, SDP, IPs or
tokens. Selected relay/direct diagnostics are visible only in debug builds.

Incall-manager handles audio focus, ringtone/vibration, ringback, keep-awake,
earpiece/speaker, and available headset/Bluetooth routes. Bluetooth permission
is optional and requested at call start/accept on Android 12+. Camera is paused
in background; audio and the peer remain alive. See [TESTING.md](TESTING.md) for
the foreground-service and lock-screen limits.

## Needs shared change: Home wiring

Home can import the following without changing the root layout:

```tsx
import { RecentCalls, startCall, registerCallNotifications } from '@/features/calls';

// Existing Home button handlers:
onPress={() => { void startCall('audio'); }}
onPress={() => { void startCall('video'); }}

// Inside the Home screen:
<RecentCalls limit={5} />

// Optional notification onboarding, with the signed-in user's ID:
await registerCallNotifications(userId, true);
```

Alternatively link Home to `/call`, which already contains those buttons,
notification onboarding, and history. Foreground call UI is global, so startCall
does not require navigation. Home must show its own loading/disabled state using
`useCalls(s => s.ready)` and `useCalls(s => s.phase)` if desired.

No dependency or shared local file was changed. `backend.sql` is the call-specific
policy source; it was applied to the current Supabase project as migration
`couple_calls_broadcast`. New environments must apply it with their normal backend
migration workflow. The table and both Edge Functions already existed.

## Verification scripts

Run the commands documented in TESTING.md from the repository root. The live
script uses existing ignored account credentials and public deployment env values,
creates/deletes only its own temporary call rows, and sends a deliberately stale
test push. It never prints credentials or commits them. Do not run that check
against accounts actively exercising calls at the same time.

The Supabase security advisor reports two existing findings outside this feature:
the intentional membership helper [my_couple_id SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
and [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
The new policies follow the existing membership helper and introduce no callable
privileged function. Shared Auth/security settings were not altered.

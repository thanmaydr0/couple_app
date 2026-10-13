# Voice notes

`VoiceRecorder` and `VoicePlayer` are exported from this feature for embedding.
Chat's body codec remains in `chat/body.ts`; voice captions/summaries go through
that boundary. Voice metadata is feature-owned; shared database types are untouched.

Recorder: hold, slide left to discard, slide up to lock, Send/Discard controls,
permission/settings flow, metering reduced to 64 bounded peaks, mono 24 kHz AAC
at 48 kbps, maximum five minutes and 3 MiB. A five-minute recording targets about
1.8 MB. A screen-reader activate action starts hands-free capture. Backgrounding
stops capture: locked notes are saved/enqueued, unlocked notes are discarded.
In-app calls and native audio-focus loss finalize a partial note. Headset input
is preferred when offered by Android; denial/failure falls back to the phone mic.
The bundled silent WAV stays muted and exists solely because Expo's Android
recorder does not request focus, while its player does. It is removed after capture.

Chat copies files into its durable existing outbox before enqueueing. Connectivity
and foreground transitions retry failed outbox items using the same client ID and
Storage path. Server lookup recovers ambiguous timeouts. Status ticks follow the
existing sending/failed/sent/seen contract. Played receipts are separate from seen
receipts, recipient-only, timestamped by the server, and immutable thereafter.
The waveform and duration cannot be edited by the recipient. Playback receipts
are attempted while playing; a failed receipt can retry during playback/replay.

Playback is a single shared player, with coalesced seeking, speed changes,
focus/background/call pause and automatic playback of the next loaded consecutive
voice note. Text/image/deleted/pending rows break that sequence. Capsule audio uses
the private capsules bucket and existing server unlock gates; no new schema fields
are required there. Capsules have a progress track when waveform metadata is absent.
Capsule local recordings use a separate folder so chat outbox cleanup cannot erase them.

## Deployment performed

Applied `supabase/migrations/300_voice.sql` to the linked Couple_app project.
Existing media bucket RLS scopes its first path segment to `my_couple_id()`;
the migration adds audio MIME types without replacing its current allowlist.
The existing scheduler already deletes chat media paths, including voice files,
after expiration/deletion. No new Edge Function or secrets are needed.

## Verification

- `npx tsc --noEmit`: passed on the final code.
- `node --test src/features/voice/verify.mjs src/features/chat/verify.mjs src/features/chat/verify-plus.mjs`: 21 passed.
- `verify.sql`: live, authenticated-role checks of insertion, sender/recipient
  authorization, immutable metadata, idempotent receipt, invalid duration/path and
  cross-couple denial. Transaction rolled back all fixtures and cleanup jobs.
- `node src/features/voice/verify-storage.mjs`: AAC upload, retry upsert, partner
  signed download and voice-only capsule privacy passed; disposable files/row removed.
- `npx expo-doctor`: 19/21 checks passed. Existing patch-version differences and
  react-native-incall-manager/react-native-webrtc New Architecture warnings remain.
- Supabase security advisors: no voice function warning; existing extension,
  intentional authenticated definer functions and leaked-password setting warnings remain.
- `adb devices`: no connected device. No native build or export was performed.

## Regression checklist (device checks remain unverified)

- Text: typing, emoji insertion, replies, edits, reactions, pins, search, schedules,
  disappearing messages, pagination/scroll anchoring and sending/sent/seen ticks.
- Images: gallery permission, compression, upload/retry, caption/reply, cached photos,
  view-once access, zoom viewer behavior and deletion/expiration cleanup.
- Voice: short tap, permission denial/grant, hold/release, cancel trash animation,
  slide lock, accessible lock, discard/send and five-minute automatic stop.
- Interruptions: phone call, in-app incoming/outgoing call, other audio taking focus,
  headset disconnect/reconnect, Bluetooth permission denial and backgrounding while locked.
- Offline: enqueue, kill/reopen after enqueue, reconnect, ambiguous upload/insert
  timeout, retry without duplicate messages, sender hears receipt updates live.
- Playback: seek during loading/drag, pause/resume, every speed, one audible source,
  consecutive notes stopping at text/photo boundaries, Reduced/Off motion and large fonts.
- Capsules: voice-only save/edit, replace audio, retained draft after failed save,
  receiver cannot sign sealed audio, successful unseal, author preview and playback.

## Needs shared change

No shared change is required for voice functionality. Dependency patch alignment
and the existing native-library warnings belong to the shared/N0 maintenance wave.
Reusable components remain inside this feature, as authorized, with theme tokens.
Device verification cannot be completed until an Android device is available.

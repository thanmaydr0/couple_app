# End-to-end encryption

Chat encryption is opt-in per couple and starts OFF. It uses X25519 key agreement (TweetNaCl `box.before`) and authenticated XSalsa20-Poly1305 secretbox encryption. Each user has one long-lived X25519 identity key. Each message and attachment gets a fresh random nonce; attachment keys are included only inside the encrypted message payload. This is an established primitive composition, but it is not a ratchet and does not provide forward secrecy.

## What is protected

With encryption enabled, message text, edits, voice-note duration and waveform, reply target, attachment key and MIME type, and client-fetched link-preview details are inside the message ciphertext. Image and voice bytes are encrypted before upload. Reaction emoji, scheduled-message content, and capsule title, body, and attachment keys are also encrypted on the phone. Supabase stores a versioned envelope and ciphertext; `body` and the existing message `meta` are null for encrypted messages. Message pushes always use generic text.

Legacy plaintext remains readable and is labeled in the chat. Each phone can optionally encrypt the messages that account authored. The conversion skips view-once images, deleted or expired messages, and system messages. It can be retried after a pause. Existing capsules are not bulk converted; only newly saved or edited capsules use E2EE. It cannot erase plaintext already present in database backups, logs, push history, old devices, or screenshots.

The chat search indexes only decrypted messages already loaded or saved on that phone. The chat cache is sealed with a key derived from the local identity secret. Temporary decrypted attachment files are removed when the app backgrounds. Android secure-screen protection is applied to the view-once viewer and encryption setup, but this does not protect a compromised or rooted device, memory inspection, a modified client, the keyboard, or an external camera.

## What remains visible

Encryption does not hide who is in the couple, sender and recipient, message kind (text/photo/voice), server timestamps, message and client IDs, reply relationships, attachment storage paths and approximate sizes, delivery/read/viewed/pinned/deletion/expiry state, or capsule scheduling and unlock metadata. Realtime, auth, storage, and notification services also see ordinary operational data. A recipient can copy, photograph, or remember decrypted content.

Link previews are fetched directly by the sender's phone and embedded in ciphertext; the encrypted-chat path does not submit a link to the server preview function. The destination website still sees that phone's network request. Search terms stay on the phone.

## Keys, verification, and recovery

Each phone stores its private key in Android SecureStore and uploads a recovery backup encrypted with a passphrase-derived scrypt key. The passphrase must be at least 16 characters; six randomly selected words are recommended. The app yields while scrypt runs. Supabase stores the encrypted backup, salt, and derivation parameters, but never receives the passphrase or private key in plaintext.

Both accounts must register keys and backups before the couple can enable encryption. Compare the same 60-digit safety number in person. The patterned visual is a side-by-side fingerprint, not a scannable QR code. Verification is recorded on each phone. A changed partner key raises a persistent warning and blocks sending until acknowledged; compare the new number with the partner before trusting it.

On a new phone, sign in, open Settings → Privacy · Encryption, and restore the existing key with the recovery passphrase. If the passphrase is forgotten and no working device can restore the old key, reset to a new key. The partner will see a safety-number change, and this phone may permanently lose access to messages encrypted to the old key. Keep an old signed-in phone until recovery is confirmed. The other partner's device may still be able to read its own copy.

Turning encryption off affects future messages only. Existing ciphertext still requires the key. Turning it back on requires both registered backups; cancel pending plaintext schedules first. While enabled, database guards reject plaintext from old clients and block unauthenticated key or flag writes. Both phones must run the updated app before starting the ceremony.

## Threat model and limits

This protects stored message content from a database or storage reader who does not control either phone or obtain the long-lived identity keys. It does not protect against a malicious or compromised app build, account takeover, device compromise, a person with an unlocked phone, an untrusted recipient, notification/device backups, or future key theft. There is no forward secrecy: anyone who later obtains a user's long-term private key can derive past shared keys and decrypt recorded messages addressed to that key. A safety-number comparison helps detect a substituted public key only when both people compare it over a trusted in-person channel.

No local Android device was available during implementation, so background cleanup, secure-screen behavior, and media playback still need the two-phone check below.

## Two-phone rollout check

1. Install the updated Android app on both phones and sign into the two accounts in the same couple.
2. On each phone, open Settings → Privacy · Encryption. Enter the same strong recovery passphrase twice and register the key and backup. Save the passphrase somewhere safe outside the app.
3. Compare all 60 safety-number digits in person. Compare the visual fingerprint as a quick second check, then mark the number verified on each phone.
4. On either phone, turn on encryption. Confirm both phones show encrypted chat and no safety-number-change warning.
5. Send a text, edit it, reply to it, react with an emoji, pin and unpin it, and delete a disposable test message. Confirm the partner sees the content and the chat labels it encrypted.
6. Send an ordinary photo, a voice note, and a view-once photo. Confirm each opens on the partner's phone; background and reopen the app to check that temporary decrypted files are removed. View-once history conversion is intentionally skipped.
7. Send a link and verify its preview appears while server link-preview requests remain absent. Search for a phrase already loaded on each phone and confirm it finds local decrypted content without sending the search term to Supabase.
8. Schedule a message, let it dispatch, and check the partner receives only generic push text. Cancel all leftover schedules before turning encryption off.
9. Run “Encrypt my legacy history” separately on each phone. Confirm older authored rows become encrypted and legacy system/view-once rows remain unchanged.
10. Restore the existing backup on a second/new device with the same passphrase and verify old content opens. On a disposable test account only, reset the key and confirm the partner receives the changed-key warning. Do not reset a real key unless its recovery implications are understood.

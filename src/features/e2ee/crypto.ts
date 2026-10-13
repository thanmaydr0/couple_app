// Platform-free protocol. Randomness is injected by the platform adapter.
import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';
import { scrypt } from 'scrypt-js';

export type Random = (length: number) => Uint8Array;
export type Envelope = { v: 1; nonce: string; ciphertext: string; senderKey: string; recipientKey: string };
export type Context = { couple: string; author: string; client: string; kind: string };
export type Sealed = { nonce: string; ciphertext: string };
export const b64 = encodeBase64;
export const bytes = decodeBase64;
export const utf8 = decodeUTF8;
export const text = encodeUTF8;
export const backupParams = { N: 32768, r: 8, p: 1, dkLen: 32 } as const;
export function keyPair(random: Random) { return nacl.box.keyPair.fromSecretKey(random(32)); }
function shared(peer: string, secret: Uint8Array): Uint8Array {
  const pub = bytes(peer);
  if (pub.length !== 32 || secret.length !== 32) throw new Error('Invalid encryption key');
  const raw = nacl.scalarMult(secret, pub);
  if (raw.every(value => value === 0)) throw new Error('Unsafe public key');
  raw.fill(0);
  return nacl.box.before(pub, secret);
}
export function seal(data: Uint8Array, key: Uint8Array, random: Random): Sealed {
  const nonce = random(24);
  if (nonce.length !== 24) throw new Error('Secure randomness unavailable');
  return { nonce: b64(nonce), ciphertext: b64(nacl.secretbox(data, nonce, key)) };
}
export function open(data: Sealed, key: Uint8Array): Uint8Array {
  const result = nacl.secretbox.open(bytes(data.ciphertext), bytes(data.nonce), key);
  if (!result) throw new Error('Cannot decrypt: wrong key or damaged ciphertext');
  return result;
}
export function encrypt(value: unknown, context: Context, secret: Uint8Array, peer: string, random: Random): Envelope {
  const own = b64(nacl.box.keyPair.fromSecretKey(secret).publicKey);
  const key = shared(peer, secret);
  try { return { v: 1, ...seal(utf8(JSON.stringify({ context, value })), key, random), senderKey: own, recipientKey: peer }; }
  finally { key.fill(0); }
}
export function decrypt(envelope: Envelope, context: Context, secret: Uint8Array): unknown {
  if (envelope.v !== 1) throw new Error('Update the app to read this encryption version');
  const own = b64(nacl.box.keyPair.fromSecretKey(secret).publicKey);
  const peer = envelope.senderKey === own ? envelope.recipientKey : envelope.recipientKey === own ? envelope.senderKey : null;
  if (!peer) throw new Error('Restore the key used for this message');
  const key = shared(peer, secret);
  try {
    const decoded: unknown = JSON.parse(text(open(envelope, key)));
    if (!decoded || typeof decoded !== 'object' || !('context' in decoded) || !('value' in decoded)) throw new Error('Invalid payload');
    const c = decoded.context as Context;
    if (c.couple !== context.couple || c.author !== context.author || c.client !== context.client || c.kind !== context.kind) throw new Error('Message context mismatch');
    return decoded.value;
  } finally { key.fill(0); }
}
export function isEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return e.v === 1 && ['nonce', 'ciphertext', 'senderKey', 'recipientKey'].every(k => typeof e[k] === 'string');
}
// Canonical sorted user IDs bind the identity as well as both public keys.
export function safetyNumber(a: { id: string; key: string }, b: { id: string; key: string }): string {
  const hash = nacl.hash(utf8(JSON.stringify(['us.e2ee.safety.v1', ...[a, b].sort((x, y) => x.id.localeCompare(y.id))])));
  return Array.from({ length: 12 }, (_, i) => {
    const at = i * 4;
    const n = ((hash[at] ?? 0) * 16777216 + (hash[at + 1] ?? 0) * 65536 + (hash[at + 2] ?? 0) * 256 + (hash[at + 3] ?? 0)) % 100000;
    return String(n).padStart(5, '0');
  }).join(' ');
}
export async function passphraseKey(passphrase: string, salt: string, progress?: (fraction: number) => void) {
  if (passphrase.length < 16) throw new Error('Use at least 16 characters; prefer six random words saved somewhere safe.');
  const password = utf8(passphrase.normalize('NFKC'));
  const saltBytes = bytes(salt);
  if (saltBytes.length !== 32) throw new Error('Invalid recovery salt');
  try { return await scrypt(password, saltBytes, backupParams.N, backupParams.r, backupParams.p, backupParams.dkLen, progress); }
  finally { password.fill(0); }
}

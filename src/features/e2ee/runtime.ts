import type { SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { supabase } from '@/lib/supabase';
import { b64, bytes, decrypt, encrypt, isEnvelope, keyPair, open, passphraseKey, safetyNumber, seal, backupParams, utf8, text, type Context, type Envelope } from './crypto';

export const cryptoDb = supabase as unknown as SupabaseClient;
export const random = (length: number) => Crypto.getRandomBytes(length);
type KeyRow = { user_id: string; couple_id: string; public_key: string; key_version: number };
type LocalKey = { secret: string; public: string };
export type CryptoState = { user: string; couple: string; enabled: boolean; registered: boolean; local: boolean; both: boolean; changed: boolean; verified: boolean; safety: string; error: string | null };
const empty: CryptoState = { user: '', couple: '', enabled: false, registered: false, local: false, both: false, changed: false, verified: false, safety: '', error: null };
let state = empty;
let local: LocalKey | null = null;
let peer: KeyRow | undefined;
let trustedPeers = new Set<string>();
const listeners = new Set<() => void>();
export const snapshot = () => state;
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const publish = (value: CryptoState) => { state = value; listeners.forEach(fn => fn()); };
const localName = (user: string) => `us.e2ee.key.v1.${user}`;
const trustName = (user: string, couple: string) => `us.e2ee.trust.v1.${user}.${couple}`;
export function clearCrypto() { epoch++; refreshFlight = undefined; local = null; peer = undefined; trustedPeers.clear(); publish(empty); }
let refreshFlight: Promise<void> | undefined;
let epoch = 0;
export function startCrypto(user: string, couple: string) {
  epoch++; refreshFlight = undefined; local = null; peer = undefined; trustedPeers.clear();
  publish({ ...empty, user, couple });
}
export function refreshCrypto(): Promise<void> {
  if (refreshFlight) return refreshFlight;
  const generation = epoch;
  refreshFlight = refreshNow(generation).finally(() => { if (generation === epoch) refreshFlight = undefined; });
  return refreshFlight;
}
async function refreshNow(generation: number) {
  const { user, couple } = state;
  if (!user || !couple) throw new Error('Connect with your partner first');
  try {
    const [coupleResult, keysResult, stored, trustRaw] = await Promise.all([
      cryptoDb.from('couples').select('e2ee_enabled').eq('id', couple).single(),
      cryptoDb.from('user_keys').select('*').eq('couple_id', couple),
      SecureStore.getItemAsync(localName(user)), SecureStore.getItemAsync(trustName(user, couple)),
    ]);
    if (coupleResult.error || keysResult.error) throw coupleResult.error ?? keysResult.error;
    if (generation !== epoch) return;
    local = stored ? JSON.parse(stored) as LocalKey : null;
    const keys = keysResult.data as KeyRow[];
    const mine = keys.find(k => k.user_id === user);
    peer = keys.find(k => k.user_id !== user);
    const trust = trustRaw ? JSON.parse(trustRaw) as { key: string; verified: string; history?: string[] } : null;
    trustedPeers = new Set([...(trust?.history ?? []), ...(trust ? [trust.key] : peer ? [peer.public_key] : [])]);
    const validLocal = !!local && !!mine && local.public === mine.public_key;
    const safety = mine && peer ? safetyNumber({ id: user, key: mine.public_key }, { id: peer.user_id, key: peer.public_key }) : '';
    if (peer && !trust) await SecureStore.setItemAsync(trustName(user, couple), JSON.stringify({ key: peer.public_key, verified: '' }));
    publish({ user, couple, enabled: coupleResult.data.e2ee_enabled === true, registered: !!mine, local: validLocal, both: !!mine && !!peer, changed: !!trust && !!peer && trust.key !== peer.public_key, verified: !!safety && trust?.verified === safety, safety, error: null });
  } catch (reason) {
    if (generation === epoch) publish({ ...state, error: reason instanceof Error ? reason.message : 'Encryption unavailable. Reconnect and retry.' });
    throw reason;
  }
}
export async function acknowledgeKey(verified = false) {
  await refreshCrypto();
  if (!peer) throw new Error('Partner has not registered a key');
  await SecureStore.setItemAsync(trustName(state.user, state.couple), JSON.stringify({ key: peer.public_key, history: [...new Set([...trustedPeers, peer.public_key])].slice(-32), verified: verified ? state.safety : '' }));
  await refreshCrypto();
}
export async function setupKeys(passphrase: string, progress?: (fraction: number) => void, reset = false) {
  await refreshCrypto();
  if (state.registered && !reset) throw new Error('A key already exists. Restore it with your recovery passphrase.');
  const pair = keyPair(random); const salt = b64(random(32));
  const key = await passphraseKey(passphrase, salt, progress);
  const newLocal: LocalKey = { secret: b64(pair.secretKey), public: b64(pair.publicKey) };
  const blob = seal(utf8(JSON.stringify(newLocal)), key, random);
  key.fill(0); pair.secretKey.fill(0);
  // Save to hardware-backed storage before publishing. RPC publishes key+backup atomically.
  const pendingName = `${localName(state.user)}.pending`;
  await SecureStore.setItemAsync(pendingName, JSON.stringify(newLocal));
  const result = await cryptoDb.rpc('e2ee_register', { public_key: newLocal.public, backup_blob: blob, backup_salt: salt, backup_params: backupParams });
  if (result.error) throw result.error;
  await SecureStore.setItemAsync(localName(state.user), JSON.stringify(newLocal));
  await SecureStore.deleteItemAsync(pendingName);
  await refreshCrypto();
}
export async function restoreKeys(passphrase: string, progress?: (fraction: number) => void) {
  const result = await cryptoDb.from('key_backups').select('*').eq('user_id', state.user).single();
  if (result.error) throw result.error;
  const backup = result.data as { blob: { nonce: string; ciphertext: string }; salt: string; params: typeof backupParams };
  if (JSON.stringify(backup.params, Object.keys(backup.params).sort()) !== JSON.stringify(backupParams, Object.keys(backupParams).sort())) throw new Error('Unsupported recovery parameters; update the app');
  const key = await passphraseKey(passphrase, backup.salt, progress);
  try {
    const restored = JSON.parse(text(open(backup.blob, key))) as LocalKey;
    const pair = keyPair(() => bytes(restored.secret));
    if (b64(pair.publicKey) !== restored.public) throw new Error('Invalid recovery key');
    pair.secretKey.fill(0);
    await SecureStore.setItemAsync(localName(state.user), JSON.stringify(restored));
  } finally { key.fill(0); }
  await refreshCrypto();
  if (!state.local) throw new Error('This backup does not match the registered key');
}
export async function setEncryption(enabled: boolean) {
  await refreshCrypto();
  if (enabled && (!state.local || !state.both || state.changed)) throw new Error('Both phones need recovery-backed keys; acknowledge any safety-number change first.');
  const result = await cryptoDb.rpc('e2ee_set_enabled', { enabled });
  if (result.error) throw result.error;
  await refreshCrypto();
}
export async function encryptionRequired(couple: string): Promise<boolean> {
  if (state.couple !== couple) throw new Error('Encryption session unavailable');
  await refreshCrypto(); // fail closed on offline/stale rollout/key state
  if (state.enabled && (!state.local || !peer || state.changed)) throw new Error('Restore your keys or review the changed safety number in Privacy → Encryption.');
  return state.enabled;
}
export function encryptValue(value: unknown, context: Context): Envelope {
  if (!local || !peer || !state.local || state.changed || context.couple !== state.couple || context.author !== state.user) throw new Error('Encryption keys unavailable or changed');
  const secret = bytes(local.secret);
  try { return encrypt(value, context, secret, peer.public_key, random); } finally { secret.fill(0); }
}
export function decryptValue(value: unknown, context: Context): unknown {
  if (!isEnvelope(value) || !local || context.couple !== state.couple) throw new Error('Restore encryption keys in Settings → Privacy');
  const ownMessage = context.author === state.user;
  const peerKey = ownMessage ? value.recipientKey : value.senderKey;
  if (!trustedPeers.has(peerKey) || ownMessage && value.senderKey !== local.public || !ownMessage && (context.author !== peer?.user_id || value.recipientKey !== local.public)) throw new Error('Unknown sender key. Review the safety number first.');
  const secret = bytes(local.secret);
  try { return decrypt(value, context, secret); } finally { secret.fill(0); }
}
export function localCacheKey(): Uint8Array {
  if (!local || !state.local) throw new Error('Restore keys before caching encrypted chat');
  const secret = bytes(local.secret);
  const label = utf8('us.e2ee.local-cache.v1\0');
  const material = new Uint8Array(label.length + secret.length);
  material.set(label);
  material.set(secret, label.length);
  let digest: Uint8Array | undefined;
  try { digest = nacl.hash(material); return digest.slice(0, 32); }
  finally { secret.fill(0); material.fill(0); digest?.fill(0); }
}

import * as FS from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { b64, bytes, open, seal, text, utf8 } from '@/features/e2ee/crypto';
import { decryptValue, encryptValue, localCacheKey, random, snapshot } from '@/features/e2ee/runtime';
import type { DecryptedItem, VaultCipher, VaultItem, VaultKind, VaultVisibility } from './types';

const db = supabase as unknown as SupabaseClient;
const BUCKET = 'vault';
const LIMIT = 12;
const cache = new Map<string, string>();
const sensitiveBuffers = new Set<Uint8Array>();
let clearGeneration = 0;
const context = (item: Pick<VaultItem, 'id' | 'couple_id' | 'owner_id'>) => ({ couple: item.couple_id, author: item.owner_id, client: item.id, kind: 'vault-item-key' });
const makeId = () => Crypto.randomUUID();

function wrapKey(key: Uint8Array, visibility: VaultVisibility, item: Pick<VaultItem, 'id' | 'couple_id' | 'owner_id'>): unknown {
  if (visibility === 'both') return encryptValue({ key: b64(key) }, { couple: item.couple_id, author: item.owner_id, client: item.id, kind: 'vault-item-key' });
  const ownerKey = localCacheKey();
  try { return seal(key, ownerKey, random); } finally { ownerKey.fill(0); }
}

function unwrapKey(item: VaultItem): Uint8Array {
  if (item.enc.visibility === 'owner') {
    const ownerKey = localCacheKey();
    try {
      const sealed = item.enc.wrappedKey as { nonce: string; ciphertext: string };
      return open(sealed, ownerKey);
    } finally { ownerKey.fill(0); }
  }
  const wrapped = decryptValue(item.enc.wrappedKey, context(item));
  if (!wrapped || typeof wrapped !== 'object' || !('key' in wrapped) || typeof wrapped.key !== 'string') throw new Error('This vault key could not be read. Restore the original encryption keys.');
  return bytes(wrapped.key);
}

export function clearDecryptedVault() {
  clearGeneration += 1;
  sensitiveBuffers.forEach(buffer => buffer.fill(0));
  sensitiveBuffers.clear();
  cache.clear();
  if (FS.cacheDirectory) void FS.deleteAsync(`${FS.cacheDirectory}vault/`, { idempotent: true }).catch(() => {});
}

async function sourceBytes(uri: string): Promise<Uint8Array> {
  const info = await FS.getInfoAsync(uri);
  if (!info.exists || !info.size) throw new Error('This media file is unavailable. Choose it again from your gallery.');
  if (info.size > 20 * 1024 * 1024) throw new Error('Choose a file smaller than 20 MB.');
  const encoded = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
  return bytes(encoded);
}

async function uploadCiphertext(path: string, cipher: Uint8Array, mime: string) {
  const buffer = cipher.buffer.slice(cipher.byteOffset, cipher.byteOffset + cipher.byteLength) as ArrayBuffer;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw error;
}

export async function addMedia(uri: string, kind: Exclude<VaultKind, 'note'>, mime: string, visibility: VaultVisibility) {
  const generation = clearGeneration;
  const state = snapshot();
  if (!state.user || !state.couple) throw new Error('Connect with your partner before using the vault.');
  const id = makeId();
  const path = `${state.couple}/vault/${id}.enc`;
  const itemKey = random(32);
  sensitiveBuffers.add(itemKey);
  let clear: Uint8Array | undefined;
  let cipher: Uint8Array | undefined;
  try {
    clear = await sourceBytes(uri);
    sensitiveBuffers.add(clear);
    if (generation !== clearGeneration) throw new Error('The vault locked while adding this item.');
    const sealed = seal(clear, itemKey, random);
    cipher = bytes(sealed.ciphertext);
    const item = { id, couple_id: state.couple, owner_id: state.user };
    const enc: VaultCipher = { v: 1, visibility, mime, payload: { nonce: sealed.nonce, ciphertext: '' }, wrappedKey: wrapKey(itemKey, visibility, item) };
    await uploadCiphertext(path, cipher, 'application/octet-stream');
    const { error } = await db.from('vault_items').insert({ id, couple_id: state.couple, owner_id: state.user, kind, enc, storage_path: path });
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      throw error;
    }
    return id;
  } finally { if (clear) sensitiveBuffers.delete(clear); clear?.fill(0); if (cipher) cipher.fill(0); sensitiveBuffers.delete(itemKey); itemKey.fill(0); }
}

export async function addNote(note: string, visibility: VaultVisibility) {
  const generation = clearGeneration;
  const state = snapshot();
  if (!state.user || !state.couple) throw new Error('Connect with your partner before using the vault.');
  const id = makeId(); const itemKey = random(32); let clear = utf8(note); note = '';
  sensitiveBuffers.add(itemKey); sensitiveBuffers.add(clear);
  try {
    if (generation !== clearGeneration) throw new Error('The vault locked while saving this note.');
    const payload = seal(clear, itemKey, random);
    const item = { id, couple_id: state.couple, owner_id: state.user };
    const enc: VaultCipher = { v: 1, visibility, payload, wrappedKey: wrapKey(itemKey, visibility, item) };
    const { error } = await db.from('vault_items').insert({ id, couple_id: state.couple, owner_id: state.user, kind: 'note', enc, storage_path: null });
    if (error) throw error;
    return id;
  } finally { sensitiveBuffers.delete(clear); clear.fill(0); sensitiveBuffers.delete(itemKey); itemKey.fill(0); }
}

export async function listVaultItems(): Promise<VaultItem[]> {
  const state = snapshot();
  if (!state.couple) return [];
  const { data, error } = await db.from('vault_items').select('*').eq('couple_id', state.couple).is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as VaultItem[];
}

async function download(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  const encoded = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('The encrypted item could not be downloaded.'));
    reader.readAsDataURL(data);
  });
  return bytes(encoded);
}

export async function openItem(item: VaultItem): Promise<DecryptedItem> {
  const generation = clearGeneration;
  const itemKey = unwrapKey(item);
  sensitiveBuffers.add(itemKey);
  try {
    if (item.kind === 'note') {
      if (!item.enc.payload) throw new Error('This note is incomplete and cannot be opened.');
      const clear = open(item.enc.payload, itemKey);
      sensitiveBuffers.add(clear);
      try {
        const note = text(clear);
        if (generation !== clearGeneration) throw new Error('The vault locked while opening this item.');
        return { ...item, note };
      } finally { sensitiveBuffers.delete(clear); clear.fill(0); }
    }
    if (!item.storage_path) throw new Error('This media item has no encrypted file.');
    const cached = cache.get(item.id);
    if (cached) { cache.delete(item.id); cache.set(item.id, cached); return { ...item, localUri: cached }; }
    const encrypted = await download(item.storage_path);
    let clear: Uint8Array;
    try { clear = open({ nonce: item.enc.payload?.nonce ?? '', ciphertext: b64(encrypted) }, itemKey); sensitiveBuffers.add(clear); } finally { encrypted.fill(0); }
    if (generation !== clearGeneration) { clear.fill(0); throw new Error('The vault locked while opening this item.'); }
    const folder = `${FS.cacheDirectory}vault/`;
    await FS.makeDirectoryAsync(folder, { intermediates: true });
    const extension = item.enc.mime?.startsWith('video/') ? 'mp4' : item.enc.mime?.split('/')[1] ?? 'jpg';
    const uri = `${folder}${item.id}.${extension}`;
    try { await FS.writeAsStringAsync(uri, b64(clear), { encoding: FS.EncodingType.Base64 }); }
    catch (error) { await FS.deleteAsync(uri, { idempotent: true }).catch(() => {}); throw error; }
    finally { sensitiveBuffers.delete(clear); clear.fill(0); }
    if (generation !== clearGeneration) { await FS.deleteAsync(uri, { idempotent: true }).catch(() => {}); throw new Error('The vault locked while opening this item.'); }
    cache.set(item.id, uri);
    while (cache.size > LIMIT) {
      const oldest = cache.keys().next().value;
      if (!oldest) break;
      const removed = cache.get(oldest); cache.delete(oldest);
      if (removed) await FS.deleteAsync(removed, { idempotent: true }).catch(() => {});
    }
    return { ...item, localUri: uri };
  } finally { sensitiveBuffers.delete(itemKey); itemKey.fill(0); }
}

export async function softDelete(item: VaultItem) {
  const { error } = await db.from('vault_items').update({ deleted_at: new Date().toISOString() }).eq('id', item.id).is('deleted_at', null);
  if (error) throw error;
}

export async function restoreItem(item: VaultItem) {
  const { error } = await db.from('vault_items').update({ deleted_at: null }).eq('id', item.id);
  if (error) throw error;
}

export async function permanentlyRemoveItem(item: VaultItem) {
  const { data, error } = await db.from('vault_items').delete().eq('id', item.id).not('deleted_at', 'is', null).select('storage_path').maybeSingle();
  if (error) throw error;
  const path = (data as { storage_path: string | null } | null)?.storage_path;
  if (path) {
    const result = await supabase.storage.from(BUCKET).remove([path]);
    if (result.error) throw result.error;
  }
}

import * as FS from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { encryptValue, decryptValue } from '@/features/e2ee/runtime';
import { encryptFile, rememberFile, type FileSecret } from '@/features/e2ee/files';
import type { VoiceRecording } from '@/features/voice';
import type { Capsule, CapsuleDraft } from './types';
import { capsuleDb } from './service';
const prefix = 'us:e2ee:v1:';
const context = (row: Pick<Capsule, 'id' | 'couple_id' | 'author_id'>) => ({ couple: row.couple_id, author: row.author_id, client: row.id, kind: 'capsule' });
export function projectCapsule(row: Capsule): Capsule {
  if (!row.body.startsWith(prefix)) return row;
  try {
    const value = decryptValue(JSON.parse(row.body.slice(prefix.length)), context(row)) as { title: string; body: string; files: FileSecret[]; voiceMeta?: VoiceRecording['meta'] };
    if (typeof value.title !== 'string' || typeof value.body !== 'string' || !Array.isArray(value.files)) throw new Error('Invalid capsule');
    const paths = [...row.media_paths, ...(row.voice_path ? [row.voice_path] : [])];
    if (paths.some(path => !value.files.some(file => file.path === path))) throw new Error('Attachment context mismatch');
    value.files.forEach(rememberFile);
    return { ...row, title: value.title, body: value.body, encrypted: true, files: value.files, voiceMeta: value.voiceMeta };
  } catch { return { ...row, title: 'Encrypted capsule', body: 'Restore your recovery key in Privacy to open this capsule.', encrypted: true, media_paths: [], voice_path: null }; }
}
export async function saveEncryptedCapsule(couple: string, user: string, draft: CapsuleDraft, photos: string[], existing?: Capsule, voice?: VoiceRecording) {
  const id = existing?.id ?? randomUUID(); const uploaded: string[] = [];
  const files: FileSecret[] = [...(existing?.files ?? [])];
  let created = false;
  const wireBody = () => prefix + JSON.stringify(encryptValue({ title: draft.title, body: draft.body, files, voiceMeta: voice?.meta ?? existing?.voiceMeta }, context({ id, couple_id: couple, author_id: user })));
  const add = async (uri: string, mime: FileSecret['mime']) => {
    const path = `${couple}/capsules/${id}/${randomUUID()}.${mime === 'image/jpeg' ? 'jpg' : 'm4a'}`;
    const encrypted = await encryptFile(uri, path, mime);
    const result = await supabase.storage.from('capsules').upload(path, encrypted.ciphertext, { contentType: 'application/octet-stream', cacheControl: '0' });
    if (result.error) throw result.error;
    uploaded.push(path); files.push(encrypted.file); return path;
  };
  let media = [...(existing?.media_paths ?? [])]; let voicePath = existing?.voice_path ?? null;
  try {
    if (draft.body.length > 15000) throw new Error('Encrypted capsule letters support up to 15,000 characters.');
    if (!existing) {
      const insert = await capsuleDb.from('capsules').insert({ id, couple_id: couple, author_id: user, ...draft, title: 'Encrypted capsule', body: wireBody() });
      if (insert.error) throw insert.error; created = true;
    }
    // Convert old attachments on edit; never wrap plaintext Storage references.
    if (existing && !existing.encrypted) {
      media = [];
      for (const old of [...existing.media_paths, ...(existing.voice_path && !voice ? [existing.voice_path] : [])]) {
        const signed = await supabase.storage.from('capsules').createSignedUrl(old, 60); if (signed.error) throw signed.error;
        const uri = `${FS.cacheDirectory}capsule-convert-${randomUUID()}`;
        try {
          await FS.downloadAsync(signed.data.signedUrl, uri);
          const path = await add(uri, old === existing.voice_path ? 'audio/mp4' : 'image/jpeg');
          if (old === existing.voice_path) voicePath = path; else media.push(path);
        } finally { await FS.deleteAsync(uri, { idempotent: true }).catch(() => {}); }
      }
    }
    for (const uri of photos) media.push(await add(uri, 'image/jpeg'));
    if (voice) voicePath = await add(voice.uri, 'audio/mp4');
    const body = wireBody(); if (body.length > 30000) throw new Error('Encrypted capsule is too large. Shorten the letter.');
    const update = await capsuleDb.from('capsules').update({ ...draft, title: 'Encrypted capsule', body, media_paths: media, voice_path: voicePath }).eq('id', id).select('id').single();
    if (update.error) throw update.error;
    const old = existing ? [...existing.media_paths, ...(existing.voice_path ? [existing.voice_path] : [])].filter(path => !media.includes(path) && path !== voicePath) : [];
    if (old.length) {
      const removed = await supabase.storage.from('capsules').remove(old); if (removed.error) throw new Error('Capsule encrypted; old plaintext attachment cleanup failed.');
    }
    return id;
  } catch (reason) {
    // Keep uploaded objects when the authoritative row already references them.
    if (created) { await supabase.storage.from('capsules').remove(uploaded); await capsuleDb.from('capsules').delete().eq('id', id); }
    throw reason;
  }
}

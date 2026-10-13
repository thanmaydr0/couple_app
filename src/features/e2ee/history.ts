import * as FS from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { prepareMessage, prepareReaction } from '@/features/chat/body';
import { isMessage, type ChatMessage } from '@/features/chat/model';
import { cryptoDb, encryptionRequired, snapshot } from './runtime';
import { randomUUID } from 'expo-crypto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
type Cleanup = { id: string; oldPath: string };
async function finishCleanup(couple: string, user: string) {
  const name = `e2ee-history-cleanup:${couple}:${user}`;
  const pending = JSON.parse(await AsyncStorage.getItem(name) ?? '[]') as Cleanup[];
  for (const item of pending) {
    const row = await cryptoDb.from('messages').select('enc,media_path').eq('couple_id', couple).eq('sender_id', user).eq('id', item.id).maybeSingle();
    if (row.error) throw row.error;
    if (row.data?.enc && row.data.media_path !== item.oldPath && item.oldPath.startsWith(`${couple}/chat/`)) {
      const removed = await supabase.storage.from('media').remove([item.oldPath]); if (removed.error) throw new Error('Old plaintext attachment cleanup is pending. Retry this history pass.');
    }
    await AsyncStorage.setItem(name, JSON.stringify(pending.filter(value => value.id !== item.id)));
  }
}
export async function encryptAuthoredHistory(progress: (done: number, skipped: number) => void) {
  const { user, couple } = snapshot();
  if (!await encryptionRequired(couple)) throw new Error('Turn on encryption first');
  await finishCleanup(couple, user);
  let done = 0; let skipped = 0; let after = '';
  for (;;) {
    let query = cryptoDb.from('messages').select('*').eq('couple_id', couple).eq('sender_id', user).is('enc', null).is('deleted_at', null).neq('kind', 'system').order('id').limit(25);
    if (after) query = query.gt('id', after);
    const result = await query;
    if (result.error) throw result.error;
    const rows = (result.data as unknown[]).filter(isMessage);
    if (!rows.length) break;
    for (const row of rows) {
      if (AppState.currentState !== 'active') throw new Error('History conversion paused. Reopen Privacy and retry to continue.');
      after = row.id;
      if (row.view_once) { skipped++; progress(done, skipped); continue; }
      let uri: string | undefined; let path = row.media_path;
      try {
        if (path) {
          const signed = await supabase.storage.from('media').createSignedUrl(path, 60);
          if (signed.error) throw signed.error;
          uri = `${FS.cacheDirectory}e2ee-history-${randomUUID()}`;
          await FS.downloadAsync(signed.data.signedUrl, uri);
          path = `${path.slice(0, path.lastIndexOf('/') + 1)}${randomUUID()}.${row.kind === 'voice' ? 'm4a' : 'jpg'}`;
        }
        const message: ChatMessage = { ...row, media_path: path, localUri: uri, status: 'sent' };
        const wire = await prepareMessage(message);
        if (wire.encryptedFile && path) {
          const upload = await supabase.storage.from('media').upload(path, wire.encryptedFile, { contentType: 'application/octet-stream' });
          if (upload.error) throw upload.error;
        }
        if (row.media_path) await AsyncStorage.setItem(`e2ee-history-cleanup:${couple}:${user}`, JSON.stringify([{ id: row.id, oldPath: row.media_path }]));
        const update = await cryptoDb.rpc('e2ee_reencrypt', { message_id: row.id, encrypted: wire.enc, new_path: path });
        if (update.error) throw update.error;
        if (row.media_path) await finishCleanup(couple, user);
        done++; progress(done, skipped);
      } finally { if (uri) await FS.deleteAsync(uri, { idempotent: true }).catch(() => {}); }
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }
  const reactions = await cryptoDb.from('message_reactions').select('*').eq('couple_id', couple).eq('user_id', user).is('enc', null);
  if (reactions.error) throw reactions.error;
  for (const reaction of reactions.data as { message_id: string; emoji: string }[]) {
    const patch = await prepareReaction(couple, user, reaction.message_id, reaction.emoji);
    const update = await cryptoDb.from('message_reactions').update(patch).eq('couple_id', couple).eq('user_id', user).eq('message_id', reaction.message_id);
    if (update.error) throw update.error;
  }
  return { done, skipped };
}

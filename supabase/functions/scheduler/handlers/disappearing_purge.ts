import type { JobHandler } from '../types.ts';
export const disappearing_purge: JobHandler = async (job, { admin, signal }) => {
  const id = job.payload.message_id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid purge job');
  const found = await admin.from('messages').select('id,media_path,view_once,viewed_at,expires_at,deleted_at')
    .eq('id', id).eq('couple_id', job.couple_id).abortSignal(signal).maybeSingle();
  if (found.error) throw new Error('Purge lookup failed');
  const message = found.data;
  if (!message) return;
  const expired = !!message.expires_at && Date.parse(message.expires_at) <= Date.now();
  const opened = message.view_once && !!message.viewed_at && Date.parse(message.viewed_at) + 60_000 <= Date.now();
  if (!expired && !opened && !message.deleted_at) return;
  signal.throwIfAborted();
  // Derive paths exclusively from the scoped message, never from job payload.
  if (message.media_path) {
    if (!message.media_path.startsWith(`${job.couple_id}/${message.view_once ? 'chat-once/' : 'chat/'}`)) throw new Error('Invalid purge path');
    const removed = await admin.storage.from(message.view_once ? 'chat-once' : 'media').remove([message.media_path]);
    if (removed.error) throw new Error('Storage purge failed');
  }
  signal.throwIfAborted();
  const result = expired
    ? await admin.from('messages').delete().eq('id', id).eq('couple_id', job.couple_id).abortSignal(signal)
    : await admin.from('messages').update({ media_path: null, body: message.deleted_at ? null : undefined }).eq('id', id).eq('couple_id', job.couple_id).abortSignal(signal);
  if (result.error) throw new Error('Message purge failed');
};

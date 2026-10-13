import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { encodeBody, editedBody, projectMessage } from './body';
import { encryptionRequired, encryptValue, decryptValue } from '@/features/e2ee/runtime';
import { asSent, isMessage, type ChatMessage } from './model';
import type { ChatRow, ScheduledMessage } from './types';

// Use the existing authenticated client with feature-owned row types.
export const chatDb = supabase as unknown as SupabaseClient;
export async function updateMessage(couple: string, id: string, patch: Partial<ChatRow>): Promise<ChatMessage> {
  if ('body' in patch) {
    const original = await chatDb.from('messages').select('*').eq('couple_id', couple).eq('id', id).single();
    if (original.error) throw original.error;
    patch = { ...patch, ...await editedBody(original.data as ChatRow, patch.body ?? null) };
  }
  const { data, error } = await chatDb.from('messages').update(patch).eq('couple_id', couple).eq('id', id).select('*').single();
  if (error) throw error;
  if (!isMessage(data)) throw new Error('Invalid message response');
  return asSent(data);
}
export async function findMessages(couple: string, text: string, filter: string, signal: AbortSignal): Promise<ChatMessage[]> {
  // Search stays on the decrypted, loaded cache even after encryption is off.
  // No private search terms are sent to Supabase.
  return [];
}
export async function messageContext(couple: string, id: string): Promise<ChatMessage[]> {
  const target = await chatDb.from('messages').select('*').eq('couple_id', couple).eq('id', id).maybeSingle();
  if (target.error) throw target.error;
  if (!isMessage(target.data)) throw new Error('This message is no longer available.');
  const [older, newer] = await Promise.all([
    chatDb.from('messages').select('*').eq('couple_id', couple).or(`created_at.lt.${target.data.created_at},and(created_at.eq.${target.data.created_at},id.lt.${target.data.id})`).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50),
    chatDb.from('messages').select('*').eq('couple_id', couple).or(`created_at.gt.${target.data.created_at},and(created_at.eq.${target.data.created_at},id.gt.${target.data.id})`).order('created_at').order('id').limit(50),
  ]);
  if (older.error || newer.error) throw older.error ?? newer.error;
  return [...(older.data as unknown[]), ...(newer.data as unknown[]), target.data].filter(isMessage).map(asSent);
}
export async function saveSchedule(couple: string, uid: string, body: string, date: Date, replyTo: string | null, existing?: string, phrases?: string[], recurring = false): Promise<void> {
  const encoded = encodeBody(body);
  if (!encoded || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new Error('Choose a future date and enter a message.');
  const recurrence = recurring ? { hour: date.getHours(), minute: date.getMinutes(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } : null;
  const list = recurring ? phrases?.map(encodeBody).filter((text): text is string => !!text).slice(0, 30) : null;
  if (await encryptionRequired(couple)) {
    // Encrypt each occurrence independently on the device, never ask a server
    // to choose plaintext. Daily encryption batches the next 30 occurrences.
    const count = recurring && !existing ? 30 : 1;
    for (let index = 0; index < count; index++) {
      const id = index === 0 && existing ? existing : randomUUID();
      const due = new Date(date); due.setDate(due.getDate() + index);
      const chosen = list?.length ? list[index % list.length] ?? encoded : encoded;
      const enc = encryptValue({ body: chosen, meta: null, reply: replyTo, path: null }, { couple, author: uid, client: `scheduled:${id}`, kind: 'text' });
      const result = await chatDb.rpc('e2ee_save_schedule', { job_id: id, due: due.toISOString(), encrypted: enc, reply: replyTo, editing: index === 0 && !!existing });
      if (result.error) throw new Error(`Saved ${index} encrypted occurrences. ${result.error.message}`);
    }
    return;
  }
  const result = existing
    ? await chatDb.rpc('chat_edit_schedule', { job_id: existing, message_body: encoded, due: date.toISOString(), phrases: list, recurrence })
    : await chatDb.from('scheduled_jobs').insert({ id: randomUUID(), couple_id: couple, created_by: uid, kind: 'scheduled_message', run_at: date.toISOString(), payload: { body: encoded, client_id: randomUUID(), reply_to: replyTo, phrases: list, recurrence } });
  if (result.error) throw result.error;
}
export function projectSchedule(job: ScheduledMessage): ScheduledMessage {
  if (!job.payload.enc) return job;
  try {
    const result = decryptValue(job.payload.enc, { couple: job.couple_id, author: job.created_by, client: `scheduled:${job.id}`, kind: 'text' }) as { body: string };
    return { ...job, payload: { ...job.payload, body: result.body } };
  } catch { return { ...job, payload: { ...job.payload, body: '🔒 Restore recovery key to read this schedule' } }; }
}
export async function cancelSchedule(job: ScheduledMessage): Promise<void> {
  const { error } = await chatDb.rpc('chat_edit_schedule', { job_id: job.id, message_body: '', due: job.run_at, cancel: true });
  if (error) throw error;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { encodeBody, searchPattern } from './body';
import { asSent, isMessage, type ChatMessage } from './model';
import type { ChatRow, ScheduledMessage } from './types';

// Use the existing authenticated client with feature-owned row types.
export const chatDb = supabase as unknown as SupabaseClient;
export async function updateMessage(couple: string, id: string, patch: Partial<ChatRow>): Promise<ChatMessage> {
  const { data, error } = await chatDb.from('messages').update(patch).eq('couple_id', couple).eq('id', id).select('*').single();
  if (error) throw error;
  if (!isMessage(data)) throw new Error('Invalid message response');
  return asSent(data);
}
export async function findMessages(couple: string, text: string, filter: string, signal: AbortSignal): Promise<ChatMessage[]> {
  let query = chatDb.from('messages').select('*').eq('couple_id', couple).is('deleted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at', { ascending: false }).limit(50);
  if (text.trim()) query = query.ilike('body', searchPattern(text));
  if (filter === 'photos') query = query.eq('kind', 'image');
  if (filter === 'links') query = query.or('body.ilike.%https://%,body.ilike.%http://%');
  if (filter === 'pinned') query = query.not('pinned_at', 'is', null);
  const { data, error } = await query.abortSignal(signal);
  if (error) throw error;
  return (data as unknown[]).filter(isMessage).map(asSent);
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
  const result = existing
    ? await chatDb.rpc('chat_edit_schedule', { job_id: existing, message_body: encoded, due: date.toISOString(), phrases: list, recurrence })
    : await chatDb.from('scheduled_jobs').insert({ id: randomUUID(), couple_id: couple, created_by: uid, kind: 'scheduled_message', run_at: date.toISOString(), payload: { body: encoded, client_id: randomUUID(), reply_to: replyTo, phrases: list, recurrence } });
  if (result.error) throw result.error;
}
export async function cancelSchedule(job: ScheduledMessage): Promise<void> {
  const { error } = await chatDb.rpc('chat_edit_schedule', { job_id: job.id, message_body: '', due: job.run_at, cancel: true });
  if (error) throw error;
}

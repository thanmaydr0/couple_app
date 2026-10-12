import type { SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { Availability, Mood } from './types';

export const pulseDb = supabase as unknown as SupabaseClient;
export const limits = { heartbeatMs: 900, pushMs: 10 * 60_000, weatherMs: 30 * 60_000, clockMs: 60_000 };
export async function identity() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in to use Pulse.');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('couple_id').eq('id', data.user.id).single();
  if (profileError || !profile?.couple_id) throw new Error('Link your couple to use Pulse.');
  return { userId: data.user.id, coupleId: profile.couple_id };
}
export async function setAvailability(availability: Availability) {
  const { userId, coupleId } = await identity();
  const update = () => pulseDb.from('pulse_status').update({ availability }).eq('user_id', userId).eq('couple_id', coupleId).select('user_id');
  const result = await update();
  if (result.error) throw result.error;
  if (result.data?.length) return;
  const inserted = await pulseDb.from('pulse_status').insert({ user_id: userId, couple_id: coupleId, availability });
  // A simultaneous mood check-in wins; preserve its mood and note.
  if (inserted.error?.code === '23505') { const retry = await update(); if (retry.error) throw retry.error; }
  else if (inserted.error) throw inserted.error;
}
export async function setStatus(mood: Mood, availability: Availability, note: string) {
  const { userId, coupleId } = await identity();
  const { error } = await pulseDb.from('pulse_status').upsert({ user_id: userId, couple_id: coupleId, mood, availability, note: note.trim() || null });
  if (error) throw error;
}
const pending = new Set<string>();
export async function notifyPulse(key: string, body: string, cooldown: number) {
  if (pending.has(key)) return;
  pending.add(key);
  try {
    const last = Number(await AsyncStorage.getItem(key));
    if (last && Date.now() - last < cooldown) return;
    await AsyncStorage.setItem(key, String(Date.now()));
    const { error } = await supabase.functions.invoke('notify-partner', { body: { channel: 'pulse', title: 'A little Pulse', body, data: { route: '/us/pulse' } } });
    if (error) throw new Error('Saved, but the notification could not be delivered.');
  } finally { pending.delete(key); }
}

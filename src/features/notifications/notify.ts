import { supabase } from '@/lib/supabase';
import { AppState } from 'react-native';

export type NotificationChannel = 'messages' | 'calls' | 'pulse' | 'plans' | 'capsule' | 'location';
export type PartnerNotification = { channel: NotificationChannel; title: string; body: string; data: { route: string; [key: string]: unknown }; priority?: 'default' | 'normal' | 'high'; dataOnly?: boolean };
const sentAt = new Map<string, number>();
/** One invocation per channel per user per ten seconds. Returns false when
 * throttled/backgrounded. This is a UX budget, not server abuse protection. */
export async function notifyPartner(payload: PartnerNotification): Promise<boolean> {
  if (AppState.currentState !== 'active') return false;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to notify your partner');
  const key = `${session.user.id}:${payload.channel}`; const now = Date.now();
  if (now - (sentAt.get(key) ?? 0) < 10_000) return false;
  sentAt.set(key, now);
  const { error } = await supabase.functions.invoke('notify-partner', { body: payload });
  if (error) throw error;
  return true;
}

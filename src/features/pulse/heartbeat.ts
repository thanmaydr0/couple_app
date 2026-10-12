import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { identity, limits, notifyPulse, pulseDb } from './service';
import { todayKey } from '@/lib/couple-time';

type Transport = { channel: RealtimeChannel; userId: string; coupleId: string; timezone: string; partnerPresent: () => boolean };
let transport: Transport | undefined;
let busy = false; let last = 0;
export function attachHeartbeat(value: Transport) { transport = value; return () => { if (transport === value) transport = undefined; }; }
/** One count per tap/hold start. Hold continuation broadcasts never add counts/pushes. */
export async function sendHeartbeat(sustained = false, continuation = false): Promise<'live' | 'push' | 'throttled'> {
  if (AppState.currentState !== 'active' || busy || Date.now() - last < limits.heartbeatMs) return 'throttled';
  busy = true; last = Date.now();
  try {
    const current = transport;
    const who = current ?? await identity();
    const { data: couple, error: zoneError } = current ? { data: { timezone: current.timezone }, error: null } : await pulseDb.from('couples').select('timezone').eq('id', who.coupleId).single();
    if (zoneError) throw zoneError;
    if (!continuation) {
      const { error } = await pulseDb.from('pulse_heartbeats').insert({ couple_id: who.coupleId, user_id: who.userId, day: todayKey(couple?.timezone ?? 'Asia/Kolkata') });
      if (error) throw error;
    }
    if (AppState.currentState !== 'active') return 'throttled';
    if (current && transport === current && current.partnerPresent()) {
      const result = await current.channel.send({ type: 'broadcast', event: 'heartbeat', payload: { userId: who.userId, sustained, at: Date.now() } });
      if (result !== 'ok') throw new Error('Heartbeat connection interrupted. Try again.');
      return 'live';
    }
    if (!continuation) await notifyPulse(`pulse:heart-push:${who.coupleId}:${who.userId}`, 'They are thinking of you ♥', limits.pushMs);
    return 'push';
  } finally { busy = false; }
}

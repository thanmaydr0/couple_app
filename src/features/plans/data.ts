import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useProfile, useCouple } from '@/lib/hooks';
import { listenPlansChanges, refreshDeviceReminders } from './reminderService';
import type { Availability, Countdown, Person, PlanEvent } from './types';

// Feature tables deliberately stay outside the shared generated schema.
export const db = supabase as unknown as SupabaseClient;
type Snapshot = { events: PlanEvent[]; countdowns: Countdown[]; availability: Availability[]; people: Person[] };
const empty: Snapshot = { events: [], countdowns: [], availability: [], people: [] };
const preferenceListeners = new Set<(user: string, enabled: boolean) => void>();
export function usePlans() {
  const profileQuery = useProfile(); const coupleQuery = useCouple(); const profile = profileQuery.data; const couple = coupleQuery.data;
  const [error, setError] = useState(''); const [offline, setOffline] = useState(false); const [local, setLocal] = useState(false);
  const coupleId = profile?.couple_id; const userId = profile?.id;
  const query = useQuery<Snapshot>({ queryKey: ['plans', coupleId, userId], enabled: !!coupleId && !!userId, staleTime: 15_000, retry: 1, queryFn: async () => {
      const results = await Promise.all([db.from('events').select('*').eq('couple_id', coupleId), db.from('countdowns').select('*').eq('couple_id', coupleId), db.from('availability').select('*').eq('couple_id', coupleId), db.from('profiles').select('id,display_name,timezone,birthday').eq('couple_id', coupleId)]);
      for (const result of results) if (result.error) throw result.error;
      const next = { events: results[0]!.data as PlanEvent[], countdowns: results[1]!.data as Countdown[], availability: results[2]!.data as Availability[], people: results[3]!.data as Person[] };
      return next;
  } });
  const state = query.data ?? empty; const loading = !!coupleId && query.isLoading;
  const { refetch } = query;
  const refresh = useCallback(async () => { setError(''); await refetch(); refreshDeviceReminders(); }, [refetch]);
  useEffect(() => NetInfo.addEventListener(s => setOffline(s.isConnected === false || s.isInternetReachable === false)), []);
  useEffect(() => {
    let active = true; setLocal(false);
    if (userId) void AsyncStorage.getItem(`plans:local:${userId}`).then(value => { if (active) setLocal(value === 'true'); }).catch(() => setError('Could not load reminder preference.'));
    const listener = (user: string, enabled: boolean) => { if (user === userId) setLocal(enabled); }; preferenceListeners.add(listener);
    return () => { active = false; preferenceListeners.delete(listener); };
  }, [userId]);
  useEffect(() => {
    if (!coupleId) return;
    return listenPlansChanges((id, failure) => { if (id !== coupleId) return; if (failure) setError(failure); else { setError(''); void refetch(); } });
  }, [coupleId, refetch]);
  const setLocalEnabled = async (enabled: boolean) => { if (userId) { await AsyncStorage.setItem(`plans:local:${userId}`, String(enabled)); preferenceListeners.forEach(listener => listener(userId, enabled)); } setLocal(enabled); refreshDeviceReminders(); };
  return { ...state, profile, couple, loading: loading || profileQuery.isLoading || coupleQuery.isLoading, error: error || (query.error instanceof Error ? query.error.message : query.error ? 'Plans could not sync.' : '') || (profileQuery.error || coupleQuery.error ? 'Could not load couple details.' : ''), offline, local, setLocalEnabled, refresh };
}
const lastPush = new Map<string, number>();
export async function notifyPlan(id: string, title: string, body: string) {
  const last = lastPush.get(id) ?? 0; if (Date.now() - last < 30_000) return;
  lastPush.set(id, Date.now());
  const result = await supabase.functions.invoke('notify-partner', { body: { channel: 'plans', title, body, data: { route: '/us/plans', event_id: id } } });
  if (result.error) throw new Error('Saved, but partner push failed. They can see it in Plans.');
}

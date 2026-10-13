import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { syncNotifications } from './notifications';
import type { Person, PlanEvent } from './types';

const db = supabase as unknown as SupabaseClient;
const listeners = new Set<(coupleId: string, failure?: string) => void>();
let started = false;
let owner: string | undefined;
let epoch = 0;
let channel: ReturnType<typeof db.channel> | undefined;
let subscribedCouple: string | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight = false;
let rerun = false;
export function listenPlansChanges(listener: (coupleId: string, failure?: string) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function disconnect() { if (channel) void db.removeChannel(channel); channel = undefined; subscribedCouple = undefined; }
export function refreshDeviceReminders() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; void reconcile(); }, 0);
}
async function reconcile() {
  if (inFlight) { rerun = true; return; }
  if (!owner || AppState.currentState !== 'active') return;
  inFlight = true; const user = owner; const revision = epoch;
  try {
    const profile = await db.from('profiles').select('couple_id').eq('id', user).maybeSingle();
    if (profile.error) throw profile.error;
    const couple = profile.data?.couple_id as string | undefined;
    if (!couple || revision !== epoch) { if (!couple && revision === epoch) await syncNotifications([], [], false); return; }
    if (!channel && AppState.currentState === 'active') {
      subscribedCouple = couple; channel = db.channel(`plans-device:${user}:${couple}`);
      for (const table of ['events', 'countdowns', 'availability', 'profiles', 'couples']) channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: table === 'couples' ? `id=eq.${couple}` : `couple_id=eq.${couple}` }, () => {
        listeners.forEach(listener => listener(couple)); refreshDeviceReminders();
      });
      channel.subscribe(status => { if (status === 'SUBSCRIBED') refreshDeviceReminders(); if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') listeners.forEach(listener => listener(couple, 'Live sync interrupted. Retry to refresh Plans.')); });
    }
    const [events, people, enabled] = await Promise.all([
      db.from('events').select('*').eq('couple_id', couple),
      db.from('profiles').select('id,display_name,timezone,birthday').eq('couple_id', couple),
      AsyncStorage.getItem(`plans:local:${user}`),
    ]);
    if (events.error || people.error) throw new Error('Could not refresh device reminders.');
    if (revision !== epoch || user !== owner) return;
    const sorted = (people.data as Person[]).sort((a, b) => Number(b.id === user) - Number(a.id === user));
    await syncNotifications(events.data as PlanEvent[], sorted, enabled === 'true');
    listeners.forEach(listener => listener(couple));
  } catch {
    if (revision === epoch && subscribedCouple) listeners.forEach(listener => listener(subscribedCouple!, 'Could not refresh reminders. Saved reminders are retained; retry when online.'));
  } finally { inFlight = false; if (rerun) { rerun = false; refreshDeviceReminders(); } }
}
/** Initialized by the existing feature registry, including cold starts/deep links.
 * No root layout edit, polling, broadcasts, or background Realtime connection. */
export function startPlansReminderService() {
  if (started) return; started = true;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') return;
    if (owner !== session?.user.id) { epoch++; disconnect(); owner = session?.user.id; }
    if (!owner) void syncNotifications([], [], false).catch(() => undefined);
    else refreshDeviceReminders();
  });
  AppState.addEventListener('change', state => {
    if (state === 'active') { if (subscribedCouple) listeners.forEach(listener => listener(subscribedCouple!)); refreshDeviceReminders(); }
    else { disconnect(); if (timer) clearTimeout(timer); timer = undefined; }
  });
}

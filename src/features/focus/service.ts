import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { FocusLog, FocusSession, Plant } from './types';
import { limits } from './clock';
export const focusDb = supabase as unknown as SupabaseClient;
export async function rpcSession(name: string, args: Record<string, unknown>): Promise<FocusSession> {
    const { data, error } = await focusDb.rpc(name, args);
    if (error)
        throw error;
    return data as FocusSession;
}
async function rows<T>(table: string, coupleId: string): Promise<T[]> {
    const result: T[] = [];
    for (let offset = 0;; offset += 500) {
        const { data, error } = await focusDb.from(table).select('*').eq('couple_id', coupleId).order('id').range(offset, offset + 499);
        if (error)
            throw error;
        const page = (data ?? []) as T[];
        result.push(...page);
        if (page.length < 500)
            return result;
    }
}
export async function loadFocus(coupleId: string) {
    const before = performance.now();
    const clock = await focusDb.rpc('focus_clock');
    const after = performance.now();
    if (clock.error)
        throw clock.error;
    const anchor = { server: Date.parse(clock.data as string) + (after - before) / 2, local: after };
    const { data, error } = await focusDb.from('focus_sessions').select('*').eq('couple_id', coupleId).order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (error)
        throw error;
    let session = data as FocusSession | null;
    if (session?.status === 'active')
        session = await rpcSession('focus_sync', { p_session: session.id });
    const [logs, plants] = await Promise.all([rows<FocusLog>('focus_log', coupleId), rows<Plant>('garden_plants', coupleId)]);
    return { anchor, session, logs, plants };
}
export async function invite(s: FocusSession) {
    if (AppState.currentState !== 'active')
        return;
    const key = `focus:invite:${s.couple_id}`;
    const last = Number(await AsyncStorage.getItem(key));
    if (Date.now() - last < limits.pushMs)
        return;
    await AsyncStorage.setItem(key, String(Date.now()));
    const { error } = await supabase.functions.invoke('notify-partner', { body: { channel: 'messages', title: 'Focus together', body: 'Your partner started a focus room. Join when you’re ready.', data: { route: '/us/focus', session_id: s.id } } });
    if (error)
        throw new Error('Room started. The invitation could not be delivered.');
}

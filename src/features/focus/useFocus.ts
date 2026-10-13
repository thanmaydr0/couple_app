import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import { useProfile } from '@/lib/hooks';
import { useMotion } from '@/motion';
import { focusDb, invite, loadFocus, rpcSession } from './service';
import { limits, phaseAt } from './clock';
import { syncNotifications } from './notifications';
export function useFocus(room = false) {
    const profile = useProfile();
    const coupleId = profile.data?.couple_id;
    const userId = profile.data?.id;
    const motion = useMotion();
    const haptics = useRef(motion.level === 'full');
    haptics.current = motion.level === 'full';
    const [foreground, setForeground] = useState(AppState.currentState === 'active');
    const [offline, setOffline] = useState(false);
    const [now, setNow] = useState(Date.now());
    const [present, setPresent] = useState<string[]>([]);
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const channel = useRef<RealtimeChannel | null>(null);
    const lastCheer = useRef(0);
    const lastReceived = useRef(0);
    const client = useQueryClient();
    const key = ['focus', coupleId, userId];
    const query = useQuery({ queryKey: key, enabled: !!coupleId && !offline && foreground, refetchInterval: limits.refreshMs, queryFn: () => loadFocus(coupleId!) });
    const session = query.data?.session;
    const joined = !!session && !!query.data?.logs.some(l => l.session_id === session.id && l.user_id === userId);
    const refresh = () => client.invalidateQueries({ queryKey: ['focus', coupleId] });
    useEffect(() => { const app = AppState.addEventListener('change', s => setForeground(s === 'active')); const net = NetInfo.addEventListener(s => setOffline(s.isConnected === false || s.isInternetReachable === false)); return () => { app.remove(); net(); }; }, []);
    useEffect(() => {
        if (!foreground)
            return;
        const tick = () => { const a = query.data?.anchor; setNow(a ? a.server + performance.now() - a.local : Date.now()); };
        tick();
        const timer = setInterval(tick, limits.tickMs);
        return () => clearInterval(timer);
    }, [foreground, query.data?.anchor]);
    useEffect(() => {
        if (!coupleId || !userId || offline || !foreground) {
            setPresent([]);
            return;
        }
        const c = focusDb.channel(`focus:${coupleId}`, { config: { private: true, presence: { key: userId }, broadcast: { self: false } } });
        channel.current = c;
        c.on('presence', { event: 'sync' }, () => setPresent(Object.values(c.presenceState<{
            user_id: string;
            session_id: string;
        }>()).flat().filter(p => p.session_id === session?.id).map(p => p.user_id)));
        c.on('broadcast', { event: 'cheer' }, ({ payload }) => { if (room && joined && payload.session_id === session?.id && payload.user_id !== userId && Date.now() - lastReceived.current >= limits.cheerMs) {
            lastReceived.current = Date.now();
            setNotice('A little cheer from your partner 🌱');
            if (haptics.current)
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        } });
        c.on('postgres_changes', { event: '*', schema: 'public', table: 'focus_sessions', filter: `couple_id=eq.${coupleId}` }, () => { void refresh(); });
        c.subscribe(status => { if (status === 'SUBSCRIBED') {
            if (room && joined && session?.status === 'active')
                void c.track({ user_id: userId, session_id: session.id });
            void refresh();
        }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
            setNotice('Room reconnecting. The timer continues from its server start time.'); });
        return () => { channel.current = null; setPresent([]); void focusDb.removeChannel(c); };
    }, [coupleId, userId, room, joined, session?.id, session?.status, foreground, offline]);
    const phase = session ? phaseAt(session, now) : null;
    const lastPhase = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (!phase || !foreground || !room || !joined)
            return;
        if (lastPhase.current && lastPhase.current !== phase.key) {
            if (haptics.current)
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => { });
            void refresh();
        }
        lastPhase.current = phase.key;
    }, [phase?.key, foreground, room, joined]);
    useEffect(() => {
        if (!query.data || !foreground)
            return;
        const a = query.data.anchor;
        const time = a.server + performance.now() - a.local;
        void syncNotifications(joined ? session ?? null : null, time).then(ok => { if (!ok && room && joined)
            setNotice('Phase reminders are off. Enable reminders to receive alerts in the background.'); }).catch(() => setNotice('Phase reminders could not be scheduled.'));
    }, [session?.id, session?.status, joined, foreground]);
    async function act(fn: () => Promise<unknown>) { if (busy || offline)
        return; setBusy(true); setNotice(''); try {
        await fn();
        await refresh();
    }
    catch (e) {
        setNotice(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : 'Unable to update your room. Try again.');
    }
    finally {
        setBusy(false);
    } }
    async function start(work: number, rest: number, cycles: number, label: string) { await act(async () => { const s = await rpcSession('focus_start', { p_work: work, p_break: rest, p_cycles: cycles, p_label: label }); await refresh(); await invite(s); }); }
    async function join() { if (session)
        await act(() => rpcSession('focus_join', { p_session: session.id })); }
    async function end() { if (session)
        await act(async () => { await rpcSession('focus_sync', { p_session: session.id, p_end: true }); await syncNotifications(null, now); }); }
    async function cheer() { if (!session || !foreground || !joined || offline || !present.some(id => id !== userId) || Date.now() - lastCheer.current < limits.cheerMs)
        return; lastCheer.current = Date.now(); await act(async () => { const result = await channel.current?.send({ type: 'broadcast', event: 'cheer', payload: { session_id: session.id, user_id: userId } }); if (result !== 'ok')
        throw new Error('Your cheer could not be sent.'); setNotice('Cheer sent 🌱'); }); }
    async function reminders() { if (session)
        await act(async () => { if (!await syncNotifications(session, now, true))
            throw new Error('Reminders are disabled in Android notification settings.'); setNotice('Phase reminders enabled.'); }); }
    return { query, profile, session, joined, phase, now, offline, notice, busy, present, userId, coupleId, start, join, end, cheer, reminders, refresh };
}

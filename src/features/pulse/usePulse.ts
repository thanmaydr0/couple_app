import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useProfile } from '@/lib/hooks';
import { todayKey, useCoupleTimezone } from '@/lib/couple-time';
import { pulseDb, limits } from './service';
import type { Answer, Status } from './types';

async function loadAnswers(coupleId: string, day: string, signal: AbortSignal): Promise<Answer[]> {
  const result: Answer[] = []; const pageSize = 800;
  for (let offset = 0; ; offset += pageSize) {
    const page = await pulseDb.from('pulse_answers').select('*').eq('couple_id', coupleId).lte('day', day).order('day', { ascending: false }).order('id').range(offset, offset + pageSize - 1).abortSignal(signal);
    if (page.error) throw page.error;
    const rows = (page.data ?? []) as Answer[]; result.push(...rows);
    if (rows.length < pageSize) return result;
  }
}

export function usePulse() {
  const profile = useProfile(); const couple = useCoupleTimezone(); const [now, setNow] = useState(() => new Date()); const [offline, setOffline] = useState(false);
  useEffect(() => { const tick = () => setNow(new Date()); const timer = setInterval(tick, limits.clockMs); const sub = AppState.addEventListener('change', s => { if (s === 'active') tick(); }); const net = NetInfo.addEventListener(s => setOffline(s.isConnected === false || s.isInternetReachable === false)); return () => { clearInterval(timer); sub.remove(); net(); }; }, []);
  const day = todayKey(couple.timezone, now); const coupleId = profile.data?.couple_id; const userId = profile.data?.id;
  const data = useQuery({ queryKey: ['pulse', coupleId, userId, day], enabled: !!coupleId && !!couple.data && !offline,
    refetchInterval: limits.clockMs, queryFn: async ({ signal }) => {
      const [answers, statuses, hearts] = await Promise.all([
        loadAnswers(coupleId!, day, signal),
        pulseDb.from('pulse_status').select('*').eq('couple_id', coupleId).abortSignal(signal),
        pulseDb.from('pulse_heartbeats').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('day', day).neq('user_id', userId).abortSignal(signal)
      ]);
      if (statuses.error) throw statuses.error; if (hearts.error) throw hearts.error;
      return { answers, statuses: (statuses.data ?? []) as Status[], thoughts: hearts.count ?? 0 };
    } });
  return { ...data, day, offline, userId, coupleId, now, profileLoading: profile.isPending || (!!coupleId && couple.isPending), profileError: profile.error ?? couple.error };
}

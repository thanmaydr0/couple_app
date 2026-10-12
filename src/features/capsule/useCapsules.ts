import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { capsuleTiming, loadCapsules } from './service';

export function useCapsules() {
  const { data: session } = useSession();
  const uid = session?.user.id;
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [offline, setOffline] = useState(false);
  const query = useQuery({ queryKey: ['capsules', uid], enabled: !!uid && active && !offline,
    queryFn: () => loadCapsules(uid!), refetchInterval: active && !offline ? capsuleTiming.poll : false, retry: 1 });
  const { refetch } = query;
  useEffect(() => {
    const app = AppState.addEventListener('change', state => { setActive(state === 'active'); if (state === 'active' && uid) void refetch(); });
    const network = NetInfo.addEventListener(state => setOffline(state.isConnected === false || state.isInternetReachable === false));
    return () => { app.remove(); network(); };
  }, [uid, refetch]);
  useEffect(() => {
    if (!uid || !active || offline) return;
    const channel = supabase.channel(`capsule-list:${uid}`).on('postgres_changes', { event: '*', schema: 'public', table: 'capsules' }, () => { void refetch(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [uid, active, offline, refetch]);
  return { ...query, offline };
}

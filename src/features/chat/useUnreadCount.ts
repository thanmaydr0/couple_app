import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProfile, useSession } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { chatDb } from './plusService';

export const unreadKey = (coupleId: string, uid: string) => ['chat-unread', coupleId, uid] as const;

/** Returns a number, suitable for tabBarBadge={count || undefined}. */
export function useUnreadCount(): number {
  const { data: session } = useSession();
  const { data: profile } = useProfile();
  const coupleId = profile?.couple_id;
  const uid = session?.user.id;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['chat-unread', coupleId, uid], enabled: !!coupleId && !!uid,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!coupleId || !uid) return 0;
      const { count, error } = await chatDb.from('messages').select('id', { count: 'exact', head: true })
        .eq('couple_id', coupleId).neq('sender_id', uid).is('read_at', null).is('deleted_at',null).neq('kind','system')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      if (error) throw error;
      return count ?? 0;
    },
  });
  useEffect(() => {
    if (!coupleId || !uid) return;
    const refresh = () => { void client.invalidateQueries({ queryKey: unreadKey(coupleId, uid) }); };
    const current = supabase.channel(`chat-unread:${coupleId}:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` }, refresh)
      .subscribe((status) => { if (status === 'SUBSCRIBED') refresh(); });
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { app.remove(); void supabase.removeChannel(current); };
  }, [coupleId, uid, client]);
  return coupleId && uid ? query.data ?? 0 : 0;
}

import { useEffect, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { usePartner, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';

type PresenceStore = { partnerOnline: boolean; setPartnerOnline: (online: boolean) => void };
export const usePresence = create<PresenceStore>((set) => ({ partnerOnline: false, setPartnerOnline: (partnerOnline) => set({ partnerOnline }) }));

export function PresenceProvider({ children }: PropsWithChildren) {
  const { data: profile } = useProfile();
  const { data: partner } = usePartner();
  const client = useQueryClient();
  const coupleId = profile?.couple_id;
  const uid = profile?.id;
  const partnerId = partner?.id;
  useEffect(() => {
    if (!coupleId || !uid) return;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const invalidatePartner = () => { void client.invalidateQueries({ queryKey: ['partner', coupleId] }); };
    const heartbeat = async () => {
      const { error } = await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid);
      if (error) console.warn('Last seen update failed:', error.code);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      const oldChannel = channel;
      channel = undefined;
      if (oldChannel) void supabase.removeChannel(oldChannel);
      usePresence.getState().setPartnerOnline(false);
    };
    const start = () => {
      if (channel) return;
      const current = supabase.channel(`presence:${coupleId}`, { config: { private: true, presence: { key: uid } } });
      channel = current;
      current.on('presence', { event: 'sync' }, () => {
        if (channel !== current) return;
        const online = !!partnerId && (current.presenceState()[partnerId]?.length ?? 0) > 0;
        if (usePresence.getState().partnerOnline !== online) invalidatePartner();
        usePresence.getState().setPartnerOnline(online);
      }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `couple_id=eq.${coupleId}` }, invalidatePartner)
        .subscribe((status) => {
          if (channel !== current) return;
          if (status === 'SUBSCRIBED') void current.track({ user_id: uid });
          else { usePresence.getState().setPartnerOnline(false); invalidatePartner(); }
        });
      void heartbeat();
      timer = setInterval(() => { void heartbeat(); }, 60_000);
      invalidatePartner();
    };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start(); else stop();
    });
    return () => { subscription.remove(); stop(); };
  }, [coupleId, uid, partnerId, client]);
  return children;
}

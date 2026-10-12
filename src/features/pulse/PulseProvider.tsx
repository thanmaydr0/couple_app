import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile, usePartner } from '@/lib/hooks';
import { useCoupleTimezone } from '@/lib/couple-time';
import { supabase } from '@/lib/supabase';
import { heartbeat } from '@/lib/haptic-patterns';
import { useMotion, HeartbeatView, motionTokens } from '@/motion';
import { useTheme } from '@/theme';
import { Card, Text } from '@/ui';
import { attachHeartbeat } from './heartbeat';

export function PulseProvider({ children }: PropsWithChildren) {
  const { data: profile } = useProfile(); const { data: partner } = usePartner(); const { timezone } = useCoupleTimezone();
  const client = useQueryClient(); const motion = useMotion(); const { spacing } = useTheme();
  const [active, setActive] = useState(AppState.currentState === 'active'); const [received, setReceived] = useState(0);
  useEffect(() => { const sub = AppState.addEventListener('change', state => { setActive(state === 'active'); if (state !== 'active') setReceived(0); }); return () => sub.remove(); }, []);
  useEffect(() => {
    if (!active || !profile?.couple_id || !partner) return;
    let alive = true; let dispose: (() => void) | undefined; let seen = 0;
    const channel = supabase.channel(`pulse:${profile.couple_id}`, { config: { private: true, presence: { key: profile.id, enabled: true }, broadcast: { ack: true } } });
    channel.on('broadcast', { event: 'heartbeat' }, ({ payload }) => {
      if (!alive || AppState.currentState !== 'active' || payload.userId !== partner.id || typeof payload.at !== 'number' || Math.abs(Date.now() - payload.at) > motionTokens.drift || Date.now() - seen < motionTokens.heartbeat) return;
      seen = Date.now(); setReceived(seen); void heartbeat(motion.level === 'full');
    }).subscribe(status => {
      dispose?.(); dispose = undefined;
      if (status === 'SUBSCRIBED' && alive) {
        void channel.track({ online: true });
        dispose = attachHeartbeat({ channel, userId: profile.id, coupleId: profile.couple_id!, timezone, partnerPresent: () => Object.hasOwn(channel.presenceState(), partner.id) });
      }
    });
    const changes = supabase.channel(`pulse-data:${profile.couple_id}`);
    for (const table of ['pulse_answers', 'pulse_status', 'pulse_heartbeats']) changes.on('postgres_changes', { event: '*', schema: 'public', table, filter: `couple_id=eq.${profile.couple_id}` }, () => { void client.invalidateQueries({ queryKey: ['pulse'] }); });
    changes.subscribe();
    // RLS hides their insert before we answer; polling also discovers past-day unlocks.
    return () => { alive = false; dispose?.(); void supabase.removeChannel(channel); void supabase.removeChannel(changes); };
  }, [active, profile?.id, profile?.couple_id, partner?.id, timezone, motion.level, client]);
  useEffect(() => { if (!received) return; const timer = setTimeout(() => setReceived(0), motionTokens.toast); return () => clearTimeout(timer); }, [received]);
  return <>{children}{received > 0 && active && <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', bottom: spacing.s56, left: spacing.lg, right: spacing.lg }}><HeartbeatView><Card><Text variant="title/M">♥ Thinking of you</Text></Card></HeartbeatView></View>}</>;
}

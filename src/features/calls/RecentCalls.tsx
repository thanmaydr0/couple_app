import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { theme } from '@/ui/theme';
import { startCall, useCalls } from './engine';
import { freshInvite } from './types';

export function RecentCalls({ limit = 8 }: { limit?: number }) {
  const { data: profile } = useProfile();
  const coupleId = profile?.couple_id;
  const client = useQueryClient();
  const phase = useCalls((s) => s.phase);
  const query = useQuery({
    queryKey: ['calls', coupleId, limit], enabled: !!coupleId, refetchInterval: 15_000,
    queryFn: async ({ signal }) => {
      if (!coupleId) return [];
      const { data, error } = await supabase.from('calls').select('*').eq('couple_id', coupleId)
        .order('started_at', { ascending: false }).limit(Math.min(50, Math.max(1, limit))).abortSignal(signal);
      if (error) throw new Error('Call history could not load.');
      return data;
    },
  });
  useEffect(() => { void client.invalidateQueries({ queryKey: ['calls', coupleId] }); }, [phase, coupleId, client]);
  return <View style={styles.section}>
    <Text style={styles.heading}>Recent calls</Text>
    {query.isPending && !!coupleId && <ActivityIndicator color={theme.colors.primary} />}
    {query.error && <Pressable onPress={() => { void query.refetch(); }}><Text style={styles.meta}>Couldn't load history. Tap to retry.</Text></Pressable>}
    {!query.isPending && !query.error && !query.data?.length && <Text style={styles.meta}>Your next hello starts here.</Text>}
    {query.data?.map((call) => {
      const stale = call.status === 'ringing' && !freshInvite(call.started_at);
      const duration = call.answered_at && call.ended_at ? Math.max(0, Math.floor((Date.parse(call.ended_at) - Date.parse(call.answered_at)) / 1000)) : null;
      return <Pressable key={call.id} disabled={phase !== 'idle'} accessibilityRole="button" accessibilityLabel={`Call back with ${call.kind}`}
        onPress={() => { void startCall(call.kind); }} style={styles.row}>
        <View style={styles.icon}><Text style={styles.symbol}>{call.kind === 'video' ? '▣' : '☎'}</Text></View>
        <View style={styles.details}><Text style={styles.title}>{call.caller_id === profile?.id ? 'Outgoing' : 'Incoming'} {call.kind === 'video' ? 'video' : 'voice'}</Text>
          <Text style={styles.meta}>{stale ? 'missed' : call.status}{duration !== null ? ` · ${Math.floor(duration / 60)}m ${duration % 60}s` : ''}</Text></View>
        <Text style={styles.date}>{new Date(call.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{'\n'}{new Date(call.started_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</Text>
      </Pressable>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 12, paddingVertical: 24 }, heading: { color: theme.colors.text, fontSize: 22, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  symbol: { color: theme.colors.primary, fontSize: 22 }, details: { flex: 1, gap: 4 }, title: { color: theme.colors.text, fontSize: 15 },
  meta: { color: theme.colors.muted, fontSize: 13 }, date: { color: theme.colors.muted, textAlign: 'right', fontSize: 12 },
});

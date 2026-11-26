import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import { PressableScale, StaggerList } from '@/motion';
import { Ionicons } from '@expo/vector-icons';
import { startCall, useCalls } from './engine';
import { freshInvite } from './types';

export function RecentCalls({ limit = 8 }: { limit?: number }) {
  const { colors, surfaces, spacing, radius, typography, geometry } = useTheme();
  const styles = StyleSheet.create({
    section: { gap: spacing.s12, paddingVertical: spacing.md },
    heading: { ...typography['title/M'], color: colors.textPrimary },
    listCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: surfaces.rimStrong,
      paddingHorizontal: spacing.md,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: surfaces.divider,
      paddingVertical: spacing.s12,
      minHeight: geometry.touch,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: surfaces.softPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    details: { flex: 1, gap: 2 },
    title: { ...typography['body/M'], color: colors.textPrimary, fontWeight: '600' },
    meta: { ...typography.caption, color: colors.textSecondary },
    date: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', fontVariant: ['tabular-nums'] },
    missed: { color: colors.danger },
  });

  const { data: profile } = useProfile();
  const coupleId = profile?.couple_id;
  const client = useQueryClient();
  const phase = useCalls(s => s.phase);

  const query = useQuery({
    queryKey: ['calls', coupleId, limit],
    enabled: !!coupleId,
    refetchInterval: 15_000,
    queryFn: async ({ signal }) => {
      if (!coupleId) return [];
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('couple_id', coupleId)
        .order('started_at', { ascending: false })
        .limit(Math.min(50, Math.max(1, limit)))
        .abortSignal(signal);
      if (error) throw new Error('Call history could not load.');
      return data;
    },
  });

  useEffect(() => {
    void client.invalidateQueries({ queryKey: ['calls', coupleId] });
  }, [phase, coupleId, client]);

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Recent calls</Text>
      {query.isPending && !!coupleId && <ActivityIndicator color={colors.primary} />}
      {query.error && (
        <PressableScale accessibilityRole="button" onPress={() => void query.refetch()}>
          <Text style={styles.meta}>Couldn't load history. Tap to retry.</Text>
        </PressableScale>
      )}
      {!query.isPending && !query.error && !query.data?.length && (
        <Text style={styles.meta}>Your next hello starts here.</Text>
      )}
      {!!query.data?.length && (
        <View style={styles.listCard}>
          <StaggerList>
            {query.data.map((call, idx) => {
              const stale = call.status === 'ringing' && !freshInvite(call.started_at);
              const missed = stale || call.status === 'missed';
              const duration =
                call.answered_at && call.ended_at
                  ? Math.max(0, Math.floor((Date.parse(call.ended_at) - Date.parse(call.answered_at)) / 1000))
                  : null;
              const last = idx === (query.data?.length ?? 0) - 1;
              return (
                <PressableScale
                  sheen={false}
                  accessibilityRole="button"
                  key={call.id}
                  disabled={phase !== 'idle'}
                  accessibilityLabel={`Call back with ${call.kind}`}
                  onPress={() => void startCall(call.kind)}
                  style={[styles.row, last && { borderBottomWidth: 0 }]}
                >
                  <View style={[styles.icon, missed && { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons
                      name={call.kind === 'video' ? 'videocam' : 'call'}
                      size={18}
                      color={missed ? colors.danger : colors.primary}
                    />
                  </View>
                  <View style={styles.details}>
                    <Text style={[styles.title, missed && styles.missed]}>
                      {call.caller_id === profile?.id ? 'Outgoing' : 'Incoming'} {call.kind === 'video' ? 'video' : 'voice'}
                    </Text>
                    <Text style={[styles.meta, missed && styles.missed]}>
                      {stale ? 'missed' : call.status}
                      {duration !== null ? ` · ${Math.floor(duration / 60)}m ${duration % 60}s` : ''}
                    </Text>
                  </View>
                  <Text style={styles.date}>
                    {new Date(call.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {'\n'}
                    {new Date(call.started_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </PressableScale>
              );
            })}
          </StaggerList>
        </View>
      )}
    </View>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, ScrollView, View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Text, Button, Card, IconButton, EmptyState } from '@/ui';
import { useTheme } from '@/theme';
import { PressableScale, FadeInView } from '@/motion';
import { MovieButton, MovieCard, MovieEntrance, useMovieStyles } from './presentation';
import { usePartner, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { WatchSessionRow } from '@/types/db';
import { pickMovie, saveFile } from './local';

export default function WatchScreen() {
  const movieStyles = useMovieStyles();
  const { colors, spacing, radius, geometry } = useTheme();
  const profile = useProfile();
  const partner = usePartner();
  const router = useRouter();

  const user = profile.data?.id;
  const couple = profile.data?.couple_id;
  const [sessions, setSessions] = useState<WatchSessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  const refresh = useCallback(async () => {
    if (!couple) return;
    const { data, error: failure } = await supabase
      .from('watch_sessions')
      .select('*')
      .eq('couple_id', couple)
      .order('created_at', { ascending: false })
      .limit(30);
    if (failure) setError(failure.message);
    else setSessions(data);
  }, [couple]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    setSessions([]);
    if (!couple) return;
    const channel = supabase
      .channel(`watch-list:${couple}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watch_sessions', filter: `couple_id=eq.${couple}` },
        () => { void refresh(); }
      )
      .subscribe();
    const poll = setInterval(() => { void refresh(); }, 10000);
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    void refresh();
    return () => {
      clearInterval(poll);
      app.remove();
      void supabase.removeChannel(channel);
    };
  }, [couple, refresh]);

  async function create() {
    if (!user || !couple || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const file = await pickMovie();
      if (!file) return;
      const { data, error: failure } = await supabase
        .from('watch_sessions')
        .insert({
          couple_id: couple,
          host_id: user,
          title: file.name,
          file_size: file.size,
          duration_ms: file.durationMs,
        })
        .select()
        .single();
      if (failure) throw new Error(failure.message);
      await saveFile(user, data.id, file);
      router.push({ pathname: '/watch/[id]', params: { id: data.id } });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not create a watch session.');
    } finally {
      locked.current = false;
      setBusy(false);
      void refresh();
    }
  }

  const active = sessions.filter(s => s.status !== 'ended');

  return (
    <Screen atmosphere gradient bottomInset>
      <Header
        title="Watch Together"
        subtitle="Same movie · synchronized playback"
        onBack={() => router.back()}
        right={
          <IconButton
            name="refresh-outline"
            accessibilityLabel="Refresh watch sessions"
            onPress={() => { void refresh(); }}
          />
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { gap: spacing.lg, paddingBottom: spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cinema Hero Card */}
        <Card variant="elevated" style={[styles.heroCard, { borderColor: colors.border }]}>
          <View style={[styles.heroIconBox, { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }]}>
            <Ionicons name="film-outline" size={28} color={colors.primary} />
          </View>
          <View style={{ gap: 4 }}>
            <Text variant="title/M" style={{ textAlign: 'center' }}>Movie night, together.</Text>
            <Text variant="body/S" color="textSecondary" style={{ textAlign: 'center' }}>
              Play the same local movie file on both devices. Play, pause, and seek commands are kept in perfect sync.
            </Text>
          </View>

          <Button
            title={busy ? 'Reading local video…' : 'Pick a movie & invite partner'}
            onPress={() => { void create(); }}
            disabled={busy || !couple || !partner.data}
            style={{ width: '100%', marginTop: 6 }}
          />
        </Card>

        {(!couple || !partner.data) && (
          <View style={[styles.warningBox, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
            <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
            <Text variant="caption" color="textSecondary">
              {profile.isLoading || partner.isLoading
                ? 'Loading your couple…'
                : 'Link both partners in Settings before starting a movie session.'}
            </Text>
          </View>
        )}

        {(error || profile.error || partner.error) && (
          <Text accessibilityRole="alert" color="danger" variant="body/S" style={{ textAlign: 'center' }}>
            {error ?? profile.error?.message ?? partner.error?.message}
          </Text>
        )}

        {/* Active Sessions List */}
        <View style={{ gap: spacing.md }}>
          <Text variant="title/M">Active Sessions</Text>

          {active.map((session, index) => (
            <MovieEntrance
              key={session.id}
              animate={index < geometry.firstScreenful}
              style={[movieStyles.card, { borderRadius: radius.lg, backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.sessionHeader}>
                <Ionicons
                  name={session.host_id !== user ? 'arrow-down-circle' : 'play-circle'}
                  size={18}
                  color={colors.primary}
                />
                <Text variant="label" color="primary">
                  {session.host_id !== user ? 'Your partner invited you to watch' : 'Your active session'}
                </Text>
              </View>

              <MovieCard
                title={session.title ?? 'Untitled movie'}
                size={session.file_size}
                durationMs={session.duration_ms}
              />

              <View style={styles.sessionActions}>
                <Button
                  title={session.host_id !== user ? 'Join with my copy' : 'Return to movie'}
                  onPress={() => router.push({ pathname: '/watch/[id]', params: { id: session.id } })}
                  style={{ flex: 1 }}
                />

                <PressableScale
                  style={[styles.endPill, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}
                  accessibilityRole="button"
                  onPress={() =>
                    Alert.alert('End this session?', 'Local files and saved positions are kept.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'End session',
                        onPress: () => {
                          void supabase
                            .from('watch_sessions')
                            .update({ status: 'ended' })
                            .eq('id', session.id)
                            .eq('couple_id', couple!)
                            .then(({ error: failure }) => {
                              if (failure) setError(failure.message);
                              void refresh();
                            });
                        },
                      },
                    ])
                  }
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text variant="caption" color="danger">End</Text>
                </PressableScale>
              </View>
            </MovieEntrance>
          ))}

          {active.length === 0 && (
            <EmptyState
              title="No open sessions"
              description="Pick a video file on your phone to invite your partner to watch together."
            />
          )}
        </View>

        {/* Tip banner */}
        <View style={[styles.tipCard, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
            Both of you need the same video file stored locally on your devices. Unprotected MP4 / MKV files work best.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
  },
  heroCard: {
    alignItems: 'center',
    padding: 22,
    gap: 12,
  },
  heroIconBox: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  endPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
  },
});

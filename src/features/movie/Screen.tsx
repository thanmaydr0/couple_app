import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen, Header, Text as ThemeText } from '@/ui';
import { useTheme } from '@/theme';
import { PressableScale } from '@/motion';
import { MovieButton, MovieCard, MovieEntrance, useMovieStyles } from './presentation';
import { usePartner, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { WatchSessionRow } from '@/types/db';
import { pickMovie, saveFile } from './local';

export default function WatchScreen() {
  const movieStyles = useMovieStyles(); const { colors, spacing, radius, geometry } = useTheme();
  const profile = useProfile(); const partner = usePartner(); const router = useRouter();
  const user = profile.data?.id; const couple = profile.data?.couple_id;
  const [sessions, setSessions] = useState<WatchSessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const locked = useRef(false);
  const refresh = useCallback(async () => {
    if (!couple) return;
    const { data, error: failure } = await supabase.from('watch_sessions').select('*').eq('couple_id', couple).order('created_at', { ascending: false }).limit(30);
    if (failure) setError(failure.message); else setSessions(data);
  }, [couple]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    setSessions([]);
    if (!couple) return;
    const channel = supabase.channel(`watch-list:${couple}`).on('postgres_changes', { event: '*', schema: 'public', table: 'watch_sessions', filter: `couple_id=eq.${couple}` }, () => { void refresh(); }).subscribe();
    const poll = setInterval(() => { void refresh(); }, 10000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    void refresh();
    return () => { clearInterval(poll); app.remove(); void supabase.removeChannel(channel); };
  }, [couple, refresh]);
  async function create() {
    if (!user || !couple || locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try {
      const file = await pickMovie(); if (!file) return;
      const { data, error: failure } = await supabase.from('watch_sessions').insert({ couple_id: couple, host_id: user, title: file.name, file_size: file.size, duration_ms: file.durationMs }).select().single();
      if (failure) throw new Error(failure.message);
      await saveFile(user, data.id, file);
      router.push({ pathname: '/watch/[id]', params: { id: data.id } });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not create a watch session.'); }
    finally { locked.current = false; setBusy(false); void refresh(); }
  }
  const active = sessions.filter(s => s.status !== 'ended');
  return <Screen><ScrollView contentContainerStyle={movieStyles.content}>
    <Header title="Watch together" subtitle="SAME MOVIE. SAME MOMENT." />
    <ThemeText variant="display/M">Movie night, together.</ThemeText>
    <Text style={movieStyles.muted}>Your movie, on both phones. Only playback controls and reactions travel between you.</Text>
    {(!couple || !partner.data) && <Text style={movieStyles.muted}>{profile.isLoading || partner.isLoading ? 'Loading your couple…' : 'Link both partners before starting a movie.'}</Text>}
    {(error || profile.error || partner.error) && <Text accessibilityRole="alert" style={movieStyles.error}>{error ?? profile.error?.message ?? partner.error?.message}</Text>}
    <View style={{ padding: spacing.lg, gap: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primary }}>
      <ThemeText variant="caption" color="primaryContrast">PICK ON YOUR OWN PHONES</ThemeText>
      <ThemeText variant="display/M" color="primaryContrast">A shared screen, miles apart.</ThemeText>
      <ThemeText variant="body/S" color="primaryContrast">Choose a movie you both have. Each of you plays it locally.</ThemeText>
    </View>
    <MovieButton label={busy ? 'Reading local video…' : 'Pick a movie & create session'} onPress={() => { void create(); }} disabled={busy || !couple || !partner.data} />
    {active.map((session, index) => <MovieEntrance key={session.id} animate={index < geometry.firstScreenful} style={movieStyles.card}>
      <Text style={movieStyles.text}>{session.host_id !== user ? 'Your partner invited you to watch' : 'Return to your movie'}</Text>
      <MovieCard title={session.title ?? 'Untitled movie'} size={session.file_size} durationMs={session.duration_ms} />
      <MovieButton label={session.host_id !== user ? 'Join with my local copy' : 'Quick return'} onPress={() => router.push({ pathname: '/watch/[id]', params: { id: session.id } })} />
      <PressableScale style={{ justifyContent: 'center', minHeight: geometry.touch }} accessibilityRole="button" onPress={() => Alert.alert('End this session?', 'Local files and saved positions are kept.', [{ text: 'Cancel', style: 'cancel' }, { text: 'End session', onPress: () => {
        void supabase.from('watch_sessions').update({ status: 'ended' }).eq('id', session.id).eq('couple_id', couple!).then(({ error: failure }) => { if (failure) setError(failure.message); void refresh(); });
      } }])}><Text style={movieStyles.muted}>End session</Text></PressableScale>
    </MovieEntrance>)}
    {active.length === 0 && <Text style={movieStyles.muted}>No open sessions. Pick a file to invite your partner.</Text>}
    <Text style={movieStyles.muted}>Both of you need the same file stored on your own device. Netflix and other DRM or streaming-app downloads cannot be used. Use an unprotected local video file.</Text>
    <MovieButton label="Refresh invitations" onPress={() => { void refresh(); }} />
  </ScrollView></Screen>;
}

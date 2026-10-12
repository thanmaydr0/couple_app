import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePartner, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { WatchSessionRow } from '@/types/db';
import { pickMovie, saveFile } from './local';
import { time } from './model';

export const movieStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#161118' }, content: { padding: 20, gap: 18, paddingBottom: 40 },
  title: { color: '#FFF2F5', fontSize: 30, fontWeight: '700' }, text: { color: '#FFF2F5', fontSize: 16 },
  muted: { color: '#BDAABF', fontSize: 14, lineHeight: 21 }, card: { backgroundColor: '#302435', borderRadius: 18, padding: 18, gap: 12 },
  button: { backgroundColor: '#EBA5B5', borderRadius: 12, minHeight: 46, padding: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#301621', fontWeight: '700', fontSize: 15 }, error: { color: '#FF9C9C', fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
export function MovieButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled} style={[movieStyles.button, disabled && { opacity: 0.45 }]}><Text style={movieStyles.buttonText}>{label}</Text></Pressable>;
}
export default function WatchScreen() {
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
  return <SafeAreaView edges={['top', 'left', 'right']} style={movieStyles.root}><ScrollView contentContainerStyle={movieStyles.content}>
    <Text style={movieStyles.title}>Watch together</Text>
    <Text style={movieStyles.muted}>Your movie, on both phones. Only playback controls and reactions travel between you.</Text>
    {(!couple || !partner.data) && <Text style={movieStyles.muted}>{profile.isLoading || partner.isLoading ? 'Loading your couple…' : 'Link both partners before starting a movie.'}</Text>}
    {(error || profile.error || partner.error) && <Text accessibilityRole="alert" style={movieStyles.error}>{error ?? profile.error?.message ?? partner.error?.message}</Text>}
    <MovieButton label={busy ? 'Reading local video…' : 'Pick a movie & create session'} onPress={() => { void create(); }} disabled={busy || !couple || !partner.data} />
    {active.map(session => <View key={session.id} style={movieStyles.card}>
      <Text style={movieStyles.text}>{session.host_id !== user ? 'Your partner invited you to watch' : 'Return to your movie'}</Text>
      <Text style={[movieStyles.text, { fontWeight: '700' }]}>{session.title ?? 'Untitled movie'}</Text>
      <Text style={movieStyles.muted}>{session.file_size?.toLocaleString() ?? '?'} bytes · {time((session.duration_ms ?? 0) / 1000)}</Text>
      <MovieButton label={session.host_id !== user ? 'Join with my local copy' : 'Quick return'} onPress={() => router.push({ pathname: '/watch/[id]', params: { id: session.id } })} />
      <Pressable accessibilityRole="button" onPress={() => Alert.alert('End this session?', 'Local files and saved positions are kept.', [{ text: 'Cancel', style: 'cancel' }, { text: 'End session', onPress: () => {
        void supabase.from('watch_sessions').update({ status: 'ended' }).eq('id', session.id).eq('couple_id', couple!).then(({ error: failure }) => { if (failure) setError(failure.message); void refresh(); });
      } }])}><Text style={movieStyles.muted}>End session</Text></Pressable>
    </View>)}
    {active.length === 0 && <Text style={movieStyles.muted}>No open sessions. Pick a file to invite your partner.</Text>}
    <Text style={movieStyles.muted}>Both of you need the same file stored on your own device. Netflix and other DRM or streaming-app downloads cannot be used. Use an unprotected local video file.</Text>
    <MovieButton label="Refresh invitations" onPress={() => { void refresh(); }} />
  </ScrollView></SafeAreaView>;
}

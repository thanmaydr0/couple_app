import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { usePartner, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { WatchSessionRow } from '@/types/db';
import { pickMovie, rememberedFile, saveFile } from './local';
import { matches, type MovieFile } from './model';
import MoviePlayer from './Player';
import { Screen, Header, Skeleton } from '@/ui';
import { MovieButton, MovieCard, MovieEntrance, useMovieStyles } from './presentation';

export default function WatchSessionScreen() {
  const s = useMovieStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfile(); const partner = usePartner(); const router = useRouter();
  const user = profile.data?.id; const couple = profile.data?.couple_id;
  const [session, setSession] = useState<WatchSessionRow | null>(null);
  const [candidate, setCandidate] = useState<MovieFile | null>(null);
  const [file, setFile] = useState<MovieFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const locked = useRef(false);
  const selection = useRef(0);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let disposed = false;
    const generation = ++selection.current;
    setFile(null); setCandidate(null); setSession(null); setError(null);
    if (!user || !couple || !id) return;
    async function load() {
      try {
        const { data, error: failure } = await supabase.from('watch_sessions').select('*').eq('id', id).eq('couple_id', couple!).single();
        if (failure) throw new Error(failure.message);
        if (disposed) return;
        setSession(data);
        if (data.status === 'ended') return;
        const remembered = await rememberedFile(user!, id);
        if (disposed || generation !== selection.current || !remembered) return;
        // A previous mismatch override is deliberately never silently reused.
        if (matches(remembered, data)) setFile(remembered); else setCandidate(remembered);
      } catch (failure) { if (!disposed) setError(failure instanceof Error ? failure.message : 'Could not load this session.'); }
    }
    void load(); return () => { disposed = true; };
  }, [id, user, couple, reload]);
  async function accept(local: MovieFile) {
    if (!user || !session) return;
    await saveFile(user, session.id, local);
    const { data, error: failure } = await supabase.from('watch_sessions').update({ status: 'active' }).eq('id', session.id).eq('couple_id', session.couple_id).neq('status', 'ended').select().maybeSingle();
    if (failure) throw new Error(failure.message);
    if (!data) throw new Error('This session has ended. Create another from the Watch tab.');
    setCandidate(null); setFile(local);
  }
  async function choose() {
    if (locked.current) return;
    ++selection.current;
    locked.current = true; setBusy(true); setError(null);
    try { const local = await pickMovie(); if (!local || !session) return; if (matches(local, session)) await accept(local); else setCandidate(local); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not open your file.'); }
    finally { locked.current = false; setBusy(false); }
  }
  function override() {
    if (!candidate) return;
    Alert.alert('Continue with a different cut?', 'Scenes may not line up even when playback times match.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue anyway', onPress: () => {
      void accept(candidate).catch(failure => setError(failure instanceof Error ? failure.message : 'Could not join.'));
    } }]);
  }
  return <Screen>
    <Stack.Screen options={{ title: session?.title ?? 'Watch together', headerShown: false }} />
    {session && file && user && partner.data && session.status !== 'ended' ? <MoviePlayer session={session} file={file} user={user} partner={partner.data.id} onChangeFile={() => { setFile(null); setCandidate(null); }} /> : <ScrollView contentContainerStyle={s.content}>
      <Header title="Watch together" subtitle="STEP 2 OF 2 / YOUR LOCAL COPY" onBack={() => router.replace('/(tabs)/watch')} />
      <Text style={s.title}>{candidate ? 'A different cut?' : session?.title ?? 'Getting your movie ready...'}</Text>
      {!session && !error && <Skeleton />}
      {(error || profile.error || partner.error) && <Text accessibilityRole="alert" style={s.error}>{error ?? profile.error?.message ?? partner.error?.message}</Text>}
      {session?.status === 'ended' ? <Text style={s.muted}>This session ended. Local files and saved positions are kept. Create a new session from the Watch tab.</Text> : <>
        <Text style={s.muted}>Choose your own copy of this movie from this phone. No video is uploaded or streamed.</Text>
        {candidate && <MovieEntrance key={candidate.uri} shake style={s.card}>
          <MovieCard file={candidate} title={candidate.name} size={candidate.size} durationMs={candidate.durationMs} />
          <Text accessibilityRole="alert" style={s.error}>These files do not match. Joining is blocked unless you override.</Text>
          <Text style={s.text}>Session: {session?.file_size?.toLocaleString() ?? 'unknown'} bytes · {session?.duration_ms ?? 'unknown'} ms</Text>
          <Text style={s.text}>Your file: {candidate.name} · {candidate.size.toLocaleString()} bytes · {candidate.durationMs} ms</Text>
          <Text style={s.muted}>Required: identical byte size and duration within 1,000 ms.</Text>
          <MovieButton secondary label="I know it's a different cut, continue anyway" onPress={override} />
        </MovieEntrance>}
        <MovieButton label={busy ? 'Reading video metadata…' : 'Pick my local video'} disabled={busy || !session || !partner.data} onPress={() => { void choose(); }} />
        {!partner.data && <Text style={s.muted}>Both partners need to be linked to join.</Text>}
      </>}
      <MovieButton secondary label="Reload session" onPress={() => setReload(v => v + 1)} />
      <MovieButton secondary label="Back to Watch" onPress={() => router.replace('/(tabs)/watch')} />
    </ScrollView>}
  </Screen>;
}

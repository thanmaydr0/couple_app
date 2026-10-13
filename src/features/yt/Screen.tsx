import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Orientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Screen, Header, Text, Avatar } from '@/ui';
import { useTheme } from '@/theme';
import { useAvatar, usePartner, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { changeQueue, sessionRow, sessionsTable } from './api';
import { fetchVideo, parseYouTube, videoList } from './links';
import { Player } from './Player';
import { PlaylistResolver } from './PlaylistResolver';
import { YtButton, YtCard } from './presentation';
import type { Video, YtSession } from './types';

/** Public entry for the future Watch tab File | YouTube switch. */
export function YouTubeEntry({ initialText = '' }: { initialText?: string }) {
  const theme = useTheme(); const { colors, spacing, geometry, radius, typography } = theme; const router = useRouter();
  const profile = useProfile(); const partner = usePartner(); const ownAvatar = useAvatar(profile.data?.avatar_path); const partnerAvatar = useAvatar(partner.data?.avatar_path);
  const couple = profile.data?.couple_id; const user = profile.data?.id; const peer = partner.data?.id;
  const dimensions = useWindowDimensions(); const landscape = dimensions.width > dimensions.height;
  const [focused, setFocused] = useState(true); const [offline, setOffline] = useState(false); const [partnerHere, setPartnerHere] = useState(false);
  const [session, setSession] = useState<YtSession | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState<string | null>(null); const [text, setText] = useState(initialText); const [previews, setPreviews] = useState<Video[]>([]); const [playlist, setPlaylist] = useState<string | null>(null);
  const [history, setHistory] = useState<Video[]>([]); const historyRef = useRef<Video[]>([]); const [current, setCurrent] = useState<Video | null>(null);
  const alive = useRef(true); const activeCouple = useRef(couple); activeCouple.current = couple;
  const previousVideo = useRef<string | null>(null); const autoStart = useRef(false);
  if (session?.current_video_id !== previousVideo.current) { autoStart.current = !!previousVideo.current && !!session?.current_video_id; previousVideo.current = session?.current_video_id ?? null; }
  const historyWrites = useRef(Promise.resolve()); const abort = useRef<AbortController | null>(null);
  useEffect(() => { setText(initialText); }, [initialText]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort(); }; }, []);
  useFocusEffect(useCallback(() => {
    setFocused(true); let previous: Orientation.OrientationLock | undefined; let cancelled = false;
    void Orientation.getOrientationLockAsync().then(value => { previous = value; if (!cancelled) return Orientation.unlockAsync(); }).catch(() => { if (!cancelled) setError('Could not enable rotation. You can continue in portrait.'); });
    return () => { cancelled = true; setFocused(false); if (previous !== undefined) void Orientation.lockAsync(previous).catch(() => {}); };
  }, []));
  useEffect(() => NetInfo.addEventListener(state => setOffline(state.isConnected === false || state.isInternetReachable === false)), []);
  const refresh = useCallback(async () => {
    if (!couple) { setLoading(false); return; }
    const { data, error: failure } = await sessionsTable().select('*').eq('couple_id', couple).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!alive.current || activeCouple.current !== couple) return;
    if (failure) { setError('Could not load YouTube sessions. Check your connection and refresh.'); setLoading(false); return; }
    setSession(data ? sessionRow(data) : null); setLoading(false);
  }, [couple]);
  useEffect(() => {
    setSession(null); setPreviews([]); setCurrent(null); setHistory([]); historyRef.current = []; setLoading(!!couple);
    if (!couple) return;
    void refresh().catch(() => { setError('Could not load YouTube. Refresh to retry.'); setLoading(false); });
    let disposed = false;
    const channel = supabase.channel(`yt-sessions:${couple}`).on('postgres_changes', { event: '*', schema: 'public', table: 'yt_sessions', filter: `couple_id=eq.${couple}` }, () => { if (!disposed) void refresh(); }).subscribe();
    const app = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    // Also recover missed database changes without broadcasting while alone.
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 15000);
    void AsyncStorage.getItem(`yt:recent:${couple}`).then(value => {
      if (disposed) return; const videos = value ? videoList(JSON.parse(value)).slice(0, 20) : []; historyRef.current = videos; setHistory(videos);
    }).catch(() => { if (!disposed) setError('Could not restore recently watched videos on this phone.'); });
    return () => { disposed = true; clearInterval(timer); app.remove(); void supabase.removeChannel(channel); abort.current?.abort(); };
  }, [couple, refresh]);
  useEffect(() => {
    const id = session?.current_video_id; let disposed = false; const controller = new AbortController();
    setPartnerHere(false); setCurrent(null);
    if (!id || !couple) return;
    const cached = historyRef.current.find(v => v.videoId === id);
    if (cached) setCurrent(cached);
    void fetchVideo(id, controller.signal).then(video => {
      if (disposed) return; setCurrent(video);
      const recent = [video, ...historyRef.current.filter(v => v.videoId !== id)].slice(0, 20); historyRef.current = recent; setHistory(recent);
      historyWrites.current = historyWrites.current.catch(() => {}).then(() => AsyncStorage.setItem(`yt:recent:${couple}`, JSON.stringify(recent)));
      void historyWrites.current.catch(() => { if (!disposed) setError('Could not save recently watched videos on this phone.'); });
    }).catch(() => { if (!disposed && !cached) setCurrent({ videoId: id, title: 'YouTube video · preview unavailable', thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }); });
    return () => { disposed = true; controller.abort(); };
  }, [session?.current_video_id, couple]);
  async function action(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await work(); } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : 'YouTube action failed. Please retry.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const validate = () => void action(async () => {
    if (offline) throw new Error('Connect to the internet to validate a YouTube link.');
    const link = parseYouTube(text); setPreviews([]);
    if (!link.videoId && link.playlistId) { setPlaylist(link.playlistId); return; }
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    const video = await fetchVideo(link.videoId!, controller.signal); if (alive.current && !controller.signal.aborted) setPreviews([video]);
  });
  const resolvePlaylist = (ids: string[]) => {
    setPlaylist(null); void action(async () => {
      abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
      const results: Video[] = [];
      // Bounded batches avoid a burst of 50 oEmbed requests.
      for (let start = 0; start < ids.length && !controller.signal.aborted; start += 4) {
        const batch = await Promise.allSettled(ids.slice(start, start + 4).map(id => fetchVideo(id, controller.signal)));
        for (const result of batch) if (result.status === 'fulfilled') results.push(result.value);
      }
      if (controller.signal.aborted || !alive.current) return;
      if (!results.length) throw new Error('No available videos were found in this public playlist.');
      setPreviews(results);
    });
  };
  const enqueue = (videos: Video[]) => void action(async () => {
    if (!couple || !user || !peer) throw new Error('Link both partners before starting YouTube.');
    if (offline) throw new Error('Connect to the internet before changing Up next.');
    const known = new Set([session?.current_video_id, ...(session?.queue.map(v => v.videoId) ?? [])]);
    videos = videos.filter(video => { if (known.has(video.videoId)) return false; known.add(video.videoId); return true; });
    const first = videos[0]; if (!first) throw new Error('Those videos are already playing or in Up next.');
    if (!session) {
      const { data, error: failure } = await sessionsTable().insert({ couple_id: couple, host_id: user, current_video_id: first.videoId, queue: videos.slice(1), status: 'active' }).select().single();
      if (failure) { await refresh(); throw new Error('Could not start YouTube. If your partner started first, their session is now shown.'); }
      setSession(sessionRow(data));
    } else {
      const queue = [...session.queue, ...videos];
      if (queue.length > 50) throw new Error('Up next holds 50 videos. Remove a few before adding more.');
      setSession(await changeQueue(session, session.current_video_id ? queue : queue.slice(1), session.current_video_id ?? queue[0]?.videoId ?? null));
    }
    setPreviews([]); setText('');
  });
  const advance = useCallback(() => {
    if (!session || lock.current || offline) return;
    void action(async () => { setSession(await changeQueue(session, session.queue.slice(1), session.queue[0]?.videoId ?? null)); });
  }, [session, offline]);
  const queueChange = (index: number, direction: 'up' | 'down' | 'remove') => void action(async () => {
    if (!session || offline) throw new Error('Reconnect before editing Up next.');
    const queue = [...session.queue];
    if (direction === 'remove') queue.splice(index, 1);
    else { const target = index + (direction === 'up' ? -1 : 1); const item = queue[index]; const other = queue[target]; if (!item || !other) return; queue[index] = other; queue[target] = item; }
    setSession(await changeQueue(session, queue));
  });
  const end = () => void action(async () => {
    if (!session || offline) throw new Error('Reconnect to end the shared session.');
    const { error: failure } = await sessionsTable().update({ status: 'ended' }).eq('id', session.id).eq('couple_id', session.couple_id);
    if (failure) throw new Error('Could not end the session. Please retry.'); setSession(null); setPartnerHere(false);
  });
  const participantRow = <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
    <Avatar name={profile.data?.display_name ?? 'You'} uri={ownAvatar.data} /><Text variant="body/S">You</Text>
    <Avatar name={partner.data?.display_name ?? 'Partner'} uri={partnerAvatar.data} /><Text variant="body/S">{partner.data?.display_name ?? 'Partner'} · {partnerHere ? 'Here' : 'Away'}</Text>
  </View>;
  const player = session?.current_video_id && user && peer && focused ? <Player key={`${session.id}:${session.current_video_id}`} session={session} user={user} partner={peer} onEnded={advance} onPresence={setPartnerHere} compact={landscape} autoStart={autoStart.current} /> : null;
  const compact = landscape && !!player;
  return <Screen style={compact ? { padding: spacing.sm } : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 }}>
    <Header title="YouTube together" subtitle="A little watch party for two" onBack={() => router.back()} right={<YtButton title="Refresh" onPress={() => void action(refresh)} disabled={busy || offline} />} />
    {!compact && participantRow}
    {offline && <YtCard><Text accessibilityLiveRegion="polite">Offline — YouTube needs an internet connection. Playback is paused; your saved queue stays here.</Text></YtCard>}
    {(error || profile.error || partner.error) && <Text accessibilityRole="alert" color="danger">{error ?? profile.error?.message ?? partner.error?.message}</Text>}
    {(loading || profile.isLoading || partner.isLoading) && <Text accessibilityLiveRegion="polite">Loading your watch party…</Text>}
    {!couple && !profile.isLoading && <Text>Link your partner to start watching together.</Text>}
    {!compact && current && <Text variant="title/M">{current.title}</Text>}
    {player}
    {!compact && <>
    {session && !session.current_video_id && <YtCard><Text>All caught up. Add a video to watch next.</Text></YtCard>}
    {!session && !loading && <YtCard><Text variant="title/M">What shall we watch?</Text><Text color="textSecondary">Paste a video, short or public playlist. Both partners can control playback.</Text></YtCard>}
    <YtCard><Text variant="title/M">Add to Up next</Text>
      <TextInput value={text} onChangeText={value => { setText(value); setPreviews([]); }} multiline maxLength={4000} accessibilityLabel="YouTube link or shared text" placeholder="Paste a YouTube link or shared text" placeholderTextColor={colors.textSecondary} style={{ ...typography['body/M'], minHeight: geometry.field, padding: spacing.s12, backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: radius.sm }} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}><YtButton title="Paste" disabled={busy} onPress={() => void action(async () => { setText(await Clipboard.getStringAsync()); setPreviews([]); })} /><YtButton title={busy ? 'Working…' : 'Preview'} onPress={validate} disabled={busy || offline || !text.trim() || !!playlist} /></View>
      {playlist && <PlaylistResolver key={playlist} id={playlist} onResolve={resolvePlaylist} onError={message => { setPlaylist(null); setError(message); }} onCancel={() => setPlaylist(null)} />}
      {previews[0] && <><VideoPreview video={previews[0]} /><Text>{previews.length === 1 ? 'Ready to add' : `${previews.length} public videos ready to add`}</Text><YtButton title={session ? 'Add to Up next' : 'Start together'} onPress={() => enqueue(previews)} disabled={busy || offline || !peer} /></>}
    </YtCard>
    <Text variant="title/M">Up next · {session?.queue.length ?? 0}</Text>
    {!session?.queue.length && <Text color="textSecondary">Your next video goes here.</Text>}
    {session?.queue.map((video, index) => <YtCard key={`${video.videoId}:${index}`}><VideoPreview video={video} /><View style={{ flexDirection: 'row', gap: spacing.sm }}><YtButton title="Move up" disabled={busy || offline || index === 0} onPress={() => queueChange(index, 'up')} /><YtButton title="Move down" disabled={busy || offline || index === session.queue.length - 1} onPress={() => queueChange(index, 'down')} /><YtButton title="Remove" disabled={busy || offline} onPress={() => queueChange(index, 'remove')} /></View></YtCard>)}
    <Text variant="title/M">Recently watched · on this phone</Text>
    {!history.length && <Text color="textSecondary">Videos you open together appear here.</Text>}
    {history.map(video => <YtCard key={video.videoId}><VideoPreview video={video} /><YtButton title="Watch again" disabled={busy || offline || !peer} onPress={() => void action(async () => { setPreviews([await fetchVideo(video.videoId)]); })} /></YtCard>)}
    {!!history.length && <YtButton title="Clear recent history" disabled={busy} onPress={() => void action(async () => { if (!couple) return; await historyWrites.current.catch(() => {}); await AsyncStorage.removeItem(`yt:recent:${couple}`); historyRef.current = []; setHistory([]); })} />}
    {session && <YtButton title="End watch party for both" onPress={end} disabled={busy || offline} />}
    <Text variant="caption" color="textSecondary">Only embeddable videos work. Ads may briefly desync playback. Sign-in and age restrictions can prevent a video from playing.</Text>
    </>}
  </ScrollView></Screen>;
}
function VideoPreview({ video }: { video: Video }) {
  const { spacing, geometry, radius } = useTheme(); const [failed, setFailed] = useState(false);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>{!failed && <Image source={{ uri: video.thumbnail }} accessibilityLabel={`Thumbnail for ${video.title}`} onError={() => setFailed(true)} style={{ width: geometry.touch * 2, height: geometry.touch, borderRadius: radius.sm }} />}<Text style={{ flex: 1 }}>{video.title}</Text></View>;
}
export default YouTubeEntry;

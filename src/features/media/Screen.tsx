import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as Picker from 'expo-image-picker';
import { useProfile, useSession } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { MediaRow } from '@/types/db';
import { MB, MediaStore, mediaStore, message } from './service';
import { Viewer } from './Viewer';

type Timeline = { type: 'header'; key: string; title: string } | { type: 'grid'; key: string; rows: MediaRow[] };
function timeline(rows: MediaRow[]) {
  const items: Timeline[] = [];
  let month = '', day = '';
  for (const row of rows) {
    const date = new Date(row.taken_at);
    const currentMonth = `${date.getFullYear()}-${date.getMonth()}`;
    const currentDay = date.toDateString();
    if (month !== currentMonth) { month = currentMonth; items.push({ type: 'header', key: month, title: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }); }
    if (day !== currentDay) { day = currentDay; items.push({ type: 'header', key: day, title: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) }); }
    const previous = items[items.length - 1];
    if (previous?.type === 'grid' && previous.rows.length < 3) previous.rows.push(row);
    else items.push({ type: 'grid', key: row.id, rows: [row] });
  }
  return items;
}
function Tile({ row, store, open }: { row: MediaRow; store: MediaStore; open: () => void }) {
  const state = useSyncExternalStore(store.subscribe, store.snapshot);
  const local = state.local[row.id];
  const path = row.thumb_path ?? (row.kind === 'photo' ? row.storage_path : null);
  const localPreview = local?.thumb ?? (row.kind === 'photo' ? local?.uri : undefined);
  const [remote, setRemote] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (!path || localPreview) return;
      void store.signed([path]).then(urls => { if (alive) { setRemote(urls[path]); setFailed(false); } }).catch(() => { if (alive) setFailed(true); });
    };
    load();
    const timer = setInterval(load, 50 * 60_000);
    const network = NetInfo.addEventListener(info => { if (info.isConnected) load(); });
    return () => { alive = false; clearInterval(timer); network(); };
  }, [path, store, localPreview]);
  return <Pressable onPress={open} style={s.tile} accessibilityRole="button" accessibilityLabel={`${row.kind}: ${row.caption ?? new Date(row.taken_at).toLocaleDateString()}`}>
    {localPreview || remote ? <Image source={{ uri: localPreview ?? remote }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="none" onError={() => setFailed(true)} /> : <Text style={s.muted}>{failed ? 'Preview unavailable' : 'Loading…'}</Text>}
    {row.kind === 'video' && <Text style={s.video}>▶ {Math.round((row.duration_ms ?? 0) / 1000)}s</Text>}
    {local && <Text style={s.badge}>Saved on this phone</Text>}
  </Pressable>;
}
function Hub({ store }: { store: MediaStore }) {
  const state = useSyncExternalStore(store.subscribe, store.snapshot);
  const [offline, setOffline] = useState(false);
  const [selection, setSelection] = useState<{ rows: MediaRow[]; initial: number }>();
  const [picking, setPicking] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const items = useMemo(() => timeline(state.rows), [state.rows]);
  const sticky = useMemo(() => items.flatMap((item, i) => item.type === 'header' ? [i] : []), [items]);
  useEffect(() => {
    void store.refresh();
    const channel = supabase.channel(`memories:${store.user}:${store.couple}`).on('postgres_changes', { event: '*', schema: 'public', table: 'media', filter: `couple_id=eq.${store.couple}` }, () => { void store.refresh(); }).subscribe(status => { setLiveError(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'); if (status === 'SUBSCRIBED') void store.refresh(); });
    const network = NetInfo.addEventListener(info => { setOffline(info.isConnected === false || info.isInternetReachable === false); if (info.isConnected && info.isInternetReachable !== false) void store.refresh(); });
    const foreground = AppState.addEventListener('change', value => { if (value === 'active') void store.refresh(); });
    return () => { void supabase.removeChannel(channel); network(); foreground.remove(); };
  }, [store]);
  const pick = async () => {
    setPicking(true);
    try {
      const permission = await Picker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Allow photo and video access in Android Settings to add memories.');
      const result = await Picker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, exif: true, quality: 1, selectionLimit: 0 });
      if (!result.canceled) store.enqueue(result.assets);
    } catch (e) { Alert.alert('Add memories', message(e)); } finally { setPicking(false); }
  };
  const used = Object.values(state.local).reduce((total, item) => total + item.bytes, 0);
  const cloudBytes = state.rows.reduce((total, item) => total + (item.size_bytes ?? 0), 0);
  return <SafeAreaView style={s.root} edges={['top']}>
    <View style={s.top}><View><Text style={s.title}>Memories</Text><Text style={s.muted}>Your story, together · {state.rows.length} moments</Text></View><Pressable disabled={picking || offline} onPress={() => void pick()} style={s.add}><Text style={s.addText}>{picking ? 'Opening…' : '+ Add'}</Text></Pressable></View>
    <View style={s.storage}><Text style={s.muted}>{(used / MB).toFixed(1)} MB saved here · {(cloudBytes / MB).toFixed(1)} MB shared originals</Text><View style={s.actions}><Pressable disabled={!!state.downloading} onPress={() => void store.downloadAll()}><Text style={s.link}>{state.downloading ? `Downloading ${state.downloading}` : 'Download all to this phone'}</Text></Pressable><Pressable disabled={!!state.downloading || !!selection} onPress={() => Alert.alert('Clear downloaded memories?', 'Removes this account’s offline copies. Shared originals and phone gallery copies remain.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear cache', onPress: () => void store.clearCache().catch(e => Alert.alert('Cache', message(e))) }])}><Text style={s.link}>Clear cache</Text></Pressable></View></View>
    {offline && <Text style={s.notice}>Offline · Showing saved timeline. Only downloaded originals can open.</Text>}
    {!offline && liveError && <Text style={s.notice}>Live updates are reconnecting. Pull to refresh for new memories.</Text>}
    {state.free < 250 * MB && <Text style={s.error}>Phone storage is nearly full. Clear cache or free space before downloading more.</Text>}
    {cloudBytes >= 900 * MB && <Text style={s.error}>Shared originals exceed 900 MB. Check the Supabase project’s available storage before adding more.</Text>}
    {!!state.error && <Pressable onPress={() => void store.refresh()}><Text style={s.error}>{state.error} Tap to retry sync.</Text></Pressable>}
    <ScrollView style={s.queue} nestedScrollEnabled>{state.jobs.filter(job => job.status !== 'done').map(job => <View key={job.id} style={s.job}><Text numberOfLines={1} style={s.text}>{job.asset.fileName ?? job.asset.type ?? 'Memory'} · {job.status} {Math.round(job.progress * 100)}%</Text>{job.error && <Text style={s.error}>{job.error}</Text>}{job.status === 'failed' && <Pressable onPress={() => store.retry(job.id)}><Text style={s.link}>Retry upload</Text></Pressable>}</View>)}</ScrollView>
    <FlashList data={items} keyExtractor={item => item.key} getItemType={item => item.type} stickyHeaderIndices={sticky} refreshing={state.loading} onRefresh={() => void store.refresh()} ListEmptyComponent={<View style={s.empty}>{state.loading ? <ActivityIndicator color="#EBA5B5" /> : <><Text style={s.title}>A little history of us</Text><Text style={s.muted}>Add your first photo or video. Both of you will see it here.</Text></>}</View>} renderItem={({ item }) => item.type === 'header' ? <View style={s.header}><Text style={s.headerText}>{item.title}</Text></View> : <View style={s.grid}>{item.rows.map(row => <Tile key={row.id} row={row} store={store} open={() => setSelection({ rows: [...state.rows], initial: state.rows.findIndex(value => value.id === row.id) })} />)}{Array.from({ length: 3 - item.rows.length }, (_, i) => <View key={`blank-${i}`} style={{ flex: 1 }} />)}</View>} />
    {selection && <Viewer rows={selection.rows} initial={selection.initial} store={store} close={() => setSelection(undefined)} />}
  </SafeAreaView>;
}
export default function Screen() {
  const { data: session } = useSession();
  const { data: profile, isLoading, error } = useProfile();
  const user = session?.user.id;
  const [remembered, setRemembered] = useState<{ user: string; couple: string }>();
  useEffect(() => {
    if (!user) { setRemembered(undefined); return; }
    let alive = true;
    const key = `memories_couple:${user}`;
    if (profile) {
      if (profile.couple_id) { setRemembered({ user, couple: profile.couple_id }); void AsyncStorage.setItem(key, profile.couple_id).catch(() => {}); }
      else { setRemembered(undefined); void AsyncStorage.removeItem(key).catch(() => {}); }
    } else { void AsyncStorage.getItem(key).then(couple => { if (alive && couple) setRemembered({ user, couple }); }).catch(() => {}); }
    return () => { alive = false; };
  }, [user, profile]);
  const couple = profile ? profile.couple_id : remembered && remembered.user === user ? remembered.couple : null;
  const store = useMemo(() => user && couple ? mediaStore(user, couple) : null, [user, couple]);
  if (!store) return <SafeAreaView style={[s.root, s.empty]}><Text style={s.title}>Memories</Text><Text style={s.muted}>{isLoading ? 'Loading your shared space…' : error ? 'Cannot load your couple. Connect to the internet and try again.' : 'Sign in and link your couple to share memories.'}</Text></SafeAreaView>;
  return <Hub key={`${user}:${couple}`} store={store} />;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: '#161118' }, top: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, title: { color: '#FFF2F5', fontSize: 26, fontWeight: '700' }, text: { color: '#FFF2F5' }, muted: { color: '#BDAABF', fontSize: 12 }, add: { backgroundColor: '#EBA5B5', borderRadius: 18, padding: 12 }, addText: { color: '#301621', fontWeight: '700' }, storage: { paddingHorizontal: 16, paddingBottom: 8, gap: 4 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, link: { color: '#EBA5B5', paddingVertical: 8 }, notice: { padding: 12, color: '#EBA5B5', backgroundColor: '#302435' }, error: { color: '#FF9C9C', padding: 8, fontSize: 12 }, queue: { maxHeight: 160 }, job: { paddingHorizontal: 16, paddingVertical: 4 }, empty: { padding: 32, gap: 16, justifyContent: 'center' }, header: { backgroundColor: '#231B27', paddingHorizontal: 16, paddingVertical: 10 }, headerText: { color: '#FFF2F5', fontSize: 15, fontWeight: '600' }, grid: { flexDirection: 'row', gap: 3, padding: 3 }, tile: { flex: 1, aspectRatio: 0.9, backgroundColor: '#302435', justifyContent: 'center', alignItems: 'center', borderRadius: 8, overflow: 'hidden' }, badge: { position: 'absolute', bottom: 4, left: 3, right: 3, color: '#FFF2F5', backgroundColor: '#161118CC', fontSize: 9, padding: 3, textAlign: 'center' }, video: { position: 'absolute', top: 5, right: 5, backgroundColor: '#161118CC', color: '#FFF2F5', padding: 4, fontSize: 10 } });

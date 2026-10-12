import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, AppState, RefreshControl, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme';
import { BottomSheet, FadeInView, PressableScale } from '@/motion';
import { Badge, Button, Card, Header, Screen as AppScreen, Text } from '@/ui';
import { Polaroids, TileEnter, TimelineSkeleton, UploadJob } from './Presentation';
import { useMediaStyles } from './styles';
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
function Tile({ row, store, open }: { row: MediaRow; store: MediaStore; open: (center?: { x: number; y: number }) => void }) {
  const s = useMediaStyles();
  const { colors, geometry } = useTheme();
  const tile = useRef<View>(null);
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
  return <View ref={tile} collapsable={false} style={s.tileWrap}><PressableScale onPress={() => { if (tile.current) tile.current.measureInWindow((x, y, width, height) => open(width > 0 && height > 0 ? { x: x + width / 2, y: y + height / 2 } : undefined)); else open(); }} style={s.tile} accessibilityRole="button" accessibilityLabel={`${row.kind}: ${row.caption ?? new Date(row.taken_at).toLocaleDateString()}`}>
    {!failed && (localPreview || remote) ? <Image source={{ uri: localPreview ?? remote }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="none" onError={() => setFailed(true)} /> : <View style={{ alignItems: 'center' }}><Ionicons name={failed ? 'cloud-offline-outline' : 'image-outline'} color={colors.textSecondary} size={geometry.icon} /><Text variant="caption" color="textSecondary">{failed ? 'Preview unavailable' : 'Loading…'}</Text></View>}
    {row.kind === 'video' && <View style={s.video}><Text variant="caption">▶ {Math.round((row.duration_ms ?? 0) / 1000)}s</Text></View>}
    {local && <FadeInView style={s.badge}><Badge label="Saved on this phone">Saved on this phone</Badge></FadeInView>}
  </PressableScale></View>;
}
function Hub({ store }: { store: MediaStore }) {
  const s = useMediaStyles();
  const { colors, spacing, geometry } = useTheme();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number }>();
  const state = useSyncExternalStore(store.subscribe, store.snapshot);
  const [offline, setOffline] = useState(false);
  const [selection, setSelection] = useState<{ rows: MediaRow[]; initial: number }>();
  const [picking, setPicking] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const items = useMemo(() => timeline(state.rows), [state.rows]);
  const firstTiles = useMemo(() => new Map(state.rows.slice(0, geometry.firstScreenful).map((row, index) => [row.id, index])), [state.rows, geometry.firstScreenful]);
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
  return <AppScreen style={{ padding: 0 }}>
    <View style={s.top}><Header title="Memories" subtitle={`YOUR STORY, TOGETHER · ${state.rows.length} moments`} /></View>
    <Card style={s.storage}>
      <Text variant="title/S">Your shared originals</Text>
      <Text variant="body/S" color="textSecondary">{(cloudBytes / MB).toFixed(1)} MB shared · {(used / MB).toFixed(1)} MB on this phone</Text>
      <View style={s.actions}><PressableScale accessibilityRole="button" disabled={!!state.downloading} onPress={() => void store.downloadAll()}><Text style={s.link}>{state.downloading ? `Downloading ${state.downloading}` : 'Download all'}</Text></PressableScale><PressableScale accessibilityRole="button" disabled={!!state.downloading || !!selection} onPress={() => Alert.alert('Clear downloaded memories?', 'Removes this account’s offline copies. Shared originals and phone gallery copies remain.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear cache', onPress: () => void store.clearCache().catch(e => Alert.alert('Cache', message(e))) }])}><Text style={s.link}>Clear cache</Text></PressableScale></View>
    </Card>
    {offline && <Text accessibilityLiveRegion="polite" style={s.notice}>Offline · Showing saved timeline. Only downloaded originals can open.</Text>}
    {!offline && liveError && <Text style={s.notice}>Live updates are reconnecting. Pull to refresh for new memories.</Text>}
    {state.free < 250 * MB && <Text style={s.warning}>Phone storage is nearly full. Clear cache or free space before downloading more.</Text>}
    {cloudBytes >= 900 * MB && <Text style={s.warning}>Shared originals exceed 900 MB. Check the Supabase project’s available storage before adding more.</Text>}
    {!!state.error && <PressableScale accessibilityRole="button" onPress={() => void store.refresh()} style={{ marginHorizontal: spacing.lg }}><Text style={s.error}>{state.error} Tap to retry sync.</Text></PressableScale>}
    {!!state.jobs.length && <PressableScale accessibilityRole="button" onPress={() => setUploadOpen(true)} style={{ marginHorizontal: spacing.lg }}><Text style={s.link}>{state.jobs.filter(job => job.status === 'done').length} of {state.jobs.length} uploaded · View uploads</Text></PressableScale>}
    <FlashList data={items} keyExtractor={item => item.key} getItemType={item => item.type} stickyHeaderIndices={sticky}
      refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => void store.refresh()} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surface} />}
      contentContainerStyle={{ paddingBottom: spacing.s56 + spacing.xl }}
      ListEmptyComponent={state.loading ? <TimelineSkeleton /> : <View style={s.empty}><Polaroids /><Text variant="title/M">A little history of us</Text><Text color="textSecondary" style={{ textAlign: 'center' }}>Add your first photo or video. Both of you will see it here.</Text><Button title="Add a memory" disabled={offline || picking} onPress={() => setUploadOpen(true)} /></View>}
      renderItem={({ item }) => item.type === 'header' ? <View style={s.header}><View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated, opacity: 1 - geometry.disabledOpacity / 2 }]} /><Text style={s.headerText}>{item.title}</Text></View> : <View style={s.grid}>{item.rows.map((row) => {
        const ordinal = firstTiles.get(row.id);
        const tile = <Tile row={row} store={store} open={center => { setOrigin(center); setSelection({ rows: [...state.rows], initial: state.rows.findIndex(value => value.id === row.id) }); }} />;
        return ordinal !== undefined ? <TileEnter key={row.id} index={ordinal} style={s.tileWrap}>{tile}</TileEnter> : <View key={row.id} style={s.tileWrap}>{tile}</View>;
      })}{Array.from({ length: 3 - item.rows.length }, (_, i) => <View key={`blank-${i}`} style={s.tileWrap} />)}</View>} />
    <PressableScale accessibilityRole="button" accessibilityLabel="Add memories" disabled={picking || offline} onPress={() => setUploadOpen(true)} style={s.fab}><Ionicons name="add" size={geometry.icon} color={colors.primaryContrast} /></PressableScale>
    <BottomSheet visible={uploadOpen} onClose={() => setUploadOpen(false)} title="Add a memory">
      <Text color="textSecondary">Photos and videos, kept together for the two of you.</Text>
      <Button title={picking ? 'Opening…' : 'Choose photos & videos'} disabled={picking || offline} onPress={() => void pick()} />
      <Text variant="body/S" color="textSecondary">Photos are compressed to JPEG (up to 2560px, 80% quality). Videos are compressed before upload. Files still 50 MB or larger are skipped. Your gallery originals stay unchanged.</Text>
      {state.jobs.map(job => <UploadJob key={job.id} job={job} retry={() => store.retry(job.id)} />)}
    </BottomSheet>
    {selection && <Viewer rows={selection.rows} initial={selection.initial} store={store} origin={origin} close={() => setSelection(undefined)} />}
  </AppScreen>;
}
export default function Screen() {
  const s = useMediaStyles();
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
  if (!store) return <AppScreen><Header title="Memories" /><View style={s.empty}><Text style={s.muted}>{isLoading ? 'Loading your shared space…' : error ? 'Cannot load your couple. Connect to the internet and try again.' : 'Sign in and link your couple to share memories.'}</Text></View></AppScreen>;
  return <Hub key={`${user}:${couple}`} store={store} />;
}

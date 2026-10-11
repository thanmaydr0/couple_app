import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Sharing from 'expo-sharing';
import * as Library from 'expo-media-library/legacy';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MediaRow } from '@/types/db';
import { MediaStore, message } from './service';

function ZoomPhoto({ uri, width, height, zoomed }: { uri: string; width: number; height: number; zoomed: (value: boolean) => void }) {
  const scale = useSharedValue(1);
  const base = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pinch = Gesture.Pinch().onUpdate(e => { scale.value = Math.max(1, Math.min(5, base.value * e.scale)); }).onEnd(() => { base.value = scale.value; if (scale.value <= 1) { x.value = withTiming(0); y.value = withTiming(0); } });
  const pan = Gesture.Pan().minPointers(2).onStart(() => { startX.value = x.value; startY.value = y.value; }).onUpdate(e => {
    const maxX = width * (scale.value - 1) / 2;
    const maxY = height * (scale.value - 1) / 2;
    x.value = Math.max(-maxX, Math.min(maxX, startX.value + e.translationX));
    y.value = Math.max(-maxY, Math.min(maxY, startY.value + e.translationY));
  });
  const notify = Gesture.Pinch().runOnJS(true).onBegin(() => zoomed(true)).onFinalize(() => zoomed(false));
  const reset = Gesture.Tap().numberOfTaps(2).onEnd(() => { scale.value = withTiming(1); base.value = 1; x.value = withTiming(0); y.value = withTiming(0); });
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  return <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, notify, reset)}><Animated.View style={[{ width, height }, animated]}><Image source={{ uri }} style={{ width, height }} contentFit="contain" cachePolicy="none" /></Animated.View></GestureDetector>;
}
function Movie({ uri, width, height, active }: { uri: string; width: number; height: number; active: boolean }) {
  const player = useVideoPlayer(uri, p => { p.loop = false; });
  useEffect(() => { if (!active) player.pause(); }, [active, player]);
  return <VideoView player={player} style={{ width, height }} nativeControls contentFit="contain" />;
}
function Page({ row, store, width, height, active, zoomed }: { row: MediaRow; store: MediaStore; width: number; height: number; active: boolean; zoomed: (value: boolean) => void }) {
  const [uri, setUri] = useState<string>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    setError('');
    void store.cache(row).then(value => { if (alive) setUri(value); }).catch(e => { if (alive) setError(message(e)); });
    return () => { alive = false; };
  }, [row.id, store, active, attempt]);
  return <View style={{ width, height, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
    {uri ? row.kind === 'photo' ? <ZoomPhoto uri={uri} width={width} height={height} zoomed={zoomed} /> : <Movie uri={uri} width={width} height={height} active={active} /> : error ? <Pressable onPress={() => setAttempt(n => n + 1)} style={styles.pad}><Text style={styles.text}>{error}</Text><Text style={styles.link}>Retry download</Text></Pressable> : active ? <ActivityIndicator color="#EBA5B5" /> : null}
  </View>;
}
export function Viewer({ rows, initial, store, close }: { rows: MediaRow[]; initial: number; store: MediaStore; close: () => void }) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initial);
  const [zoomed, setZoomed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState(rows[initial]?.caption ?? '');
  const row = rows[index];
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch (e) { Alert.alert('Memories', message(e)); } finally { setBusy(false); }
  };
  const save = () => run(async () => {
    if (!row) return;
    const permission = await Library.requestPermissionsAsync(true);
    if (!permission.granted) throw new Error('Allow gallery access in Android Settings to save this memory.');
    await Library.saveToLibraryAsync(await store.cache(row));
    Alert.alert('Saved', 'This memory is now in your phone gallery.');
  });
  return <Modal visible animationType="slide" onRequestClose={close} statusBarTranslucent><SafeAreaView style={styles.root}>
    <View style={styles.bar}><Pressable accessibilityRole="button" onPress={close}><Text style={styles.link}>Close</Text></Pressable><Text style={styles.text}>{index + 1} / {rows.length}</Text></View>
    <FlatList data={rows} horizontal pagingEnabled scrollEnabled={!zoomed && !busy} initialScrollIndex={initial} key={`${width}`} keyExtractor={item => item.id} getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })} onMomentumScrollEnd={event => { const next = Math.round(event.nativeEvent.contentOffset.x / width); setIndex(next); setCaption(rows[next]?.caption ?? ''); }} renderItem={({ item, index: pageIndex }) => <Page row={item} store={store} width={width} height={Math.max(180, height - 300)} active={pageIndex === index} zoomed={setZoomed} />} windowSize={3} maxToRenderPerBatch={3} />
    {row && <View style={styles.pad}>
      <Text style={styles.text}>{new Date(row.taken_at).toLocaleString()}</Text>
      <Text style={styles.muted}>Pinch to zoom · Drag with two fingers · Double tap to reset</Text>
      <TextInput value={caption} onChangeText={setCaption} maxLength={2000} placeholder="Add a caption…" placeholderTextColor="#BDAABF" style={styles.input} editable={!busy} accessibilityLabel="Memory caption" />
      <View style={styles.actions}>
        <Pressable disabled={busy} onPress={() => void run(async () => { await store.caption(row, caption); Alert.alert('Caption saved'); })}><Text style={styles.link}>Save caption</Text></Pressable>
        <Pressable disabled={busy} onPress={() => void save()}><Text style={styles.link}>Save to gallery</Text></Pressable>
        <Pressable disabled={busy} onPress={() => void run(async () => { if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.'); await Sharing.shareAsync(await store.cache(row)); })}><Text style={styles.link}>Share</Text></Pressable>
        {row.uploader_id === store.user && <Pressable disabled={busy} onPress={() => Alert.alert('Delete memory?', 'This removes the shared original for both of you. Copies saved to a phone gallery remain.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void run(async () => { await store.remove(row); close(); }) }])}><Text style={{ color: '#FF9C9C' }}>Delete</Text></Pressable>}
      </View>{busy && <ActivityIndicator color="#EBA5B5" />}
    </View>}
  </SafeAreaView></Modal>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#100D12' }, bar: { padding: 16, flexDirection: 'row', justifyContent: 'space-between' }, pad: { padding: 16, gap: 8 }, text: { color: '#FFF2F5' }, muted: { color: '#BDAABF', fontSize: 12 }, link: { color: '#EBA5B5', paddingVertical: 6 }, input: { color: '#FFF2F5', borderBottomColor: '#49364C', borderBottomWidth: 1, paddingVertical: 10 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 } });

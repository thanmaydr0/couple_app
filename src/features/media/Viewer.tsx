import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import * as Library from 'expo-media-library/legacy';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '@/theme';
import { motionTokens, PressableScale, useMotion } from '@/motion';
import { Header, Screen, Slider, Text } from '@/ui';
import { useMediaStyles } from './styles';
import type { MediaRow } from '@/types/db';
import { MediaStore, message } from './service';

function ZoomPhoto({ uri, width, height, zoomed }: { uri: string; width: number; height: number; zoomed: (value: boolean) => void }) {
  const motion = useMotion();
  const settle = (value: number) => { 'worklet'; return motion.level === 'full' ? withSpring(value, motion.spring('gentle')) : withTiming(value, { duration: motion.duration('fast') }); };
  const scale = useSharedValue(1);
  const base = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pinch = Gesture.Pinch().onBegin(() => { scheduleOnRN(zoomed, true); }).onUpdate(e => { scale.value = Math.max(1, Math.min(5, base.value * e.scale)); }).onEnd(() => { base.value = scale.value; if (scale.value <= 1) { x.value = settle(0); y.value = settle(0); } }).onFinalize(() => { scheduleOnRN(zoomed, scale.value > 1); });
  const pan = Gesture.Pan().minPointers(2).onStart(() => { startX.value = x.value; startY.value = y.value; }).onUpdate(e => {
    const maxX = width * (scale.value - 1) / 2;
    const maxY = height * (scale.value - 1) / 2;
    x.value = Math.max(-maxX, Math.min(maxX, startX.value + e.translationX));
    y.value = Math.max(-maxY, Math.min(maxY, startY.value + e.translationY));
  });
  const reset = Gesture.Tap().numberOfTaps(2).onEnd(() => { const next = base.value > 1 ? 1 : 2; scale.value = settle(next); base.value = next; x.value = settle(0); y.value = settle(0); scheduleOnRN(zoomed, next > 1); });
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  return <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, reset)}><Animated.View style={[{ width, height }, animated]}><Image source={{ uri }} style={{ width, height }} contentFit="contain" cachePolicy="none" /></Animated.View></GestureDetector>;
}
function Movie({ uri, width, height, active }: { uri: string; width: number; height: number; active: boolean }) {
  const player = useVideoPlayer(uri, p => { p.loop = false; });
  useEffect(() => { if (!active) player.pause(); }, [active, player]);
  const { colors, spacing, radius, geometry } = useTheme();
  const motion = useMotion();
  const [controls, setControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const video = useRef<VideoView>(null);
  const opacity = useSharedValue(1);
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const playbackTime = useEvent(player, 'timeUpdate');
  const currentTime = playbackTime?.currentTime ?? player.currentTime;
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  useEffect(() => { player.timeUpdateEventInterval = motionTokens.fast / 1000; }, [player]);
  useEffect(() => {
    opacity.value = withTiming(controls ? 1 : 0, { duration: motion.duration('fast') });
    if (!controls || !isPlaying) return;
    const timeout = setTimeout(() => setControls(false), motionTokens.toast);
    return () => clearTimeout(timeout);
  }, [controls, isPlaying, motion.level, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const time = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
  return <View style={{ width, height }}>
    <VideoView ref={video} player={player} style={{ width, height }} nativeControls={fullscreen} onFullscreenEnter={() => setFullscreen(true)} onFullscreenExit={() => setFullscreen(false)} contentFit="contain" />
    <PressableScale haptic={false} accessibilityRole="button" accessibilityLabel={controls ? 'Hide video controls' : 'Show video controls'} onPress={() => setControls(value => !value)} style={{ position: 'absolute', inset: 0 }} />
    <Animated.View pointerEvents={controls ? 'auto' : 'none'} accessibilityElementsHidden={!controls} importantForAccessibility={controls ? 'auto' : 'no-hide-descendants'} style={[{ position: 'absolute', bottom: spacing.md, left: spacing.lg, right: spacing.lg, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.bgElevated, gap: spacing.xs }, animated]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back ten seconds" onPress={() => { player.seekBy(-10); setControls(true); }} style={{ justifyContent: 'center', alignItems: 'center' }}><Ionicons name="play-back" size={geometry.icon} color={colors.primary} /></PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'} onPress={() => { if (isPlaying) player.pause(); else player.play(); }} style={{ justifyContent: 'center', alignItems: 'center' }}><Ionicons name={isPlaying ? 'pause' : 'play'} size={geometry.icon} color={colors.primary} /></PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel="Forward ten seconds" onPress={() => { player.seekBy(10); setControls(true); }} style={{ justifyContent: 'center', alignItems: 'center' }}><Ionicons name="play-forward" size={geometry.icon} color={colors.primary} /></PressableScale>
        <Text variant="caption">{time(currentTime)} / {time(player.duration || 0)}</Text>
      </View>
      <Slider accessibilityLabel="Video position" value={currentTime} maximumValue={Math.max(1, player.duration)} onValueChange={value => { player.currentTime = value; setControls(true); }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <PressableScale accessibilityRole="button" accessibilityLabel={muted ? 'Unmute video' : 'Mute video'} onPress={() => { player.muted = !muted; }} style={{ alignItems: 'center', justifyContent: 'center' }}><Ionicons name={muted ? 'volume-mute-outline' : 'volume-high-outline'} size={geometry.icon} color={colors.primary} /></PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel="Full screen video" onPress={() => { void video.current?.enterFullscreen().catch(() => Alert.alert('Video', 'Couldn’t open full screen. Try again.')); }} style={{ alignItems: 'center', justifyContent: 'center' }}><Ionicons name="expand-outline" size={geometry.icon} color={colors.primary} /></PressableScale>
      </View>
      {status === 'loading' && <Text variant="body/S" color="textSecondary">Loading video…</Text>}
      {status === 'error' && <Text variant="body/S" color="danger">This video couldn’t play. Close and reopen it to try again.</Text>}
    </Animated.View>
  </View>;
}
function Page({ row, store, width, height, active, zoomed }: { row: MediaRow; store: MediaStore; width: number; height: number; active: boolean; zoomed: (value: boolean) => void }) {
  const styles = useMediaStyles();
  const { colors } = useTheme();
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
    {uri ? row.kind === 'photo' ? <ZoomPhoto uri={uri} width={width} height={height} zoomed={zoomed} /> : <Movie uri={uri} width={width} height={height} active={active} /> : error ? <PressableScale accessibilityRole="button" onPress={() => setAttempt(n => n + 1)} style={styles.pad}><Text style={styles.text}>{error}</Text><Text style={styles.link}>Retry download</Text></PressableScale> : active ? <ActivityIndicator color={colors.primary} /> : null}
  </View>;
}
export function Viewer({ rows, initial, store, close, origin }: { rows: MediaRow[]; initial: number; store: MediaStore; close: () => void; origin?: { x: number; y: number } }) {
  const styles = useMediaStyles();
  const { colors, spacing, geometry } = useTheme();
  const motion = useMotion();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initial);
  const [zoomed, setZoomed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState(rows[initial]?.caption ?? '');
  const enter = useSharedValue(motion.level === 'off' ? 1 : 0);
  const drag = useSharedValue(0);
  const deleted = useSharedValue(1);
  useEffect(() => { enter.value = withTiming(1, { duration: motion.duration('base') }); }, [motion.level, enter]);
  const dismiss = () => {
    enter.value = withTiming(0, { duration: motion.duration('fast') }, finished => { if (finished) scheduleOnRN(close); });
  };
  const backdrop = useAnimatedStyle(() => ({ opacity: enter.value * Math.max(0, 1 - drag.value / height) }));
  const initialScale = Math.min(1, geometry.touch * 2 / width);
  const reveal = useAnimatedStyle(() => ({ opacity: enter.value * (motion.level === 'full' ? 1 : deleted.value), transform: [
    { translateX: motion.level === 'full' ? (1 - enter.value) * ((origin?.x ?? width / 2) - width / 2) : 0 },
    { translateY: (motion.level === 'full' ? (1 - enter.value) * ((origin?.y ?? height / 2) - height / 2) : 0) + drag.value },
    { scale: motion.level === 'full' ? (initialScale + (1 - initialScale) * enter.value) * deleted.value : 1 },
  ] }));
  const swipe = Gesture.Pan().enabled(!zoomed && !busy).maxPointers(1).activeOffsetY(geometry.touch / 2).failOffsetX([-geometry.touch / 2, geometry.touch / 2]).onUpdate(event => { drag.value = Math.max(0, event.translationY); }).onEnd(event => {
    if (drag.value > geometry.touch * 2 || event.velocityY > height) scheduleOnRN(dismiss);
    else drag.value = motion.level === 'full' ? withSpring(0, motion.spring('gentle')) : withTiming(0, { duration: motion.duration('fast') });
  });
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
  return <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent><GestureHandlerRootView style={{ flex: 1 }}>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0, backgroundColor: colors.bg }, backdrop]} />
    <Animated.View style={[{ flex: 1 }, reveal]}><Screen bottomInset style={{ padding: 0, backgroundColor: `${colors.bg}00` }}>
    <View style={styles.bar}><Header title="A moment together" subtitle={`${index + 1} / ${rows.length}`} right={<PressableScale accessibilityRole="button" onPress={dismiss}><Text style={styles.link}>Close</Text></PressableScale>} /></View>
    <GestureDetector gesture={swipe}><View style={{ flex: 1 }}><FlatList data={rows} horizontal pagingEnabled decelerationRate="fast" snapToInterval={width} disableIntervalMomentum showsHorizontalScrollIndicator={false} scrollEnabled={!zoomed && !busy} initialScrollIndex={initial} key={`${width}`} keyExtractor={item => item.id} getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })} onMomentumScrollEnd={event => { const next = Math.round(event.nativeEvent.contentOffset.x / width); setIndex(next); setCaption(rows[next]?.caption ?? ''); }} renderItem={({ item, index: pageIndex }) => <Page row={item} store={store} width={width} height={Math.max(geometry.touch * 3, height / 2)} active={pageIndex === index} zoomed={setZoomed} />} windowSize={3} maxToRenderPerBatch={3} /></View></GestureDetector>
    {row && <ScrollView style={{ maxHeight: height / 3 }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Text style={styles.text}>{new Date(row.taken_at).toLocaleString()}</Text>
      <Text style={styles.muted}>{row.kind === 'photo' ? 'Pinch to zoom · Double tap to zoom or reset · Swipe down to close' : 'Use playback controls · Swipe down to close'}</Text>
      <TextInput value={caption} onChangeText={setCaption} maxLength={2000} placeholder="Add a caption…" placeholderTextColor={colors.textSecondary} style={styles.input} editable={!busy} accessibilityLabel="Memory caption" />
      <View style={styles.actions}>
        <PressableScale accessibilityRole="button" disabled={busy} onPress={() => void run(async () => { await store.caption(row, caption); Alert.alert('Caption saved'); })}><Text style={styles.link}>Save caption</Text></PressableScale>
        <PressableScale accessibilityRole="button" disabled={busy} onPress={() => void save()}><Text style={styles.link}>Save to gallery</Text></PressableScale>
        <PressableScale accessibilityRole="button" disabled={busy} onPress={() => void run(async () => { if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.'); await Sharing.shareAsync(await store.cache(row)); })}><Text style={styles.link}>Share</Text></PressableScale>
        {row.uploader_id === store.user && <PressableScale accessibilityRole="button" disabled={busy} onPress={() => Alert.alert('Delete memory?', 'This removes the shared original for both of you. Copies saved to a phone gallery remain.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void run(async () => { await store.remove(row); deleted.value = withTiming(0, { duration: motion.duration('fast') }, finished => { if (finished) scheduleOnRN(dismiss); }); }) }])}><Text color="danger" style={{ padding: spacing.sm }}>Delete</Text></PressableScale>}
      </View>{busy && <ActivityIndicator color={colors.primary} />}
    </ScrollView>}
  </Screen></Animated.View></GestureHandlerRootView></Modal>;
}

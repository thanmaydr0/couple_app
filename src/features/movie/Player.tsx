import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { VideoView } from 'expo-video';
import * as Orientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import type { WatchSessionRow } from '@/types/db';
import { reactions, time, type MovieFile } from './model';
import { useWatch } from './useWatch';
import { MovieButton, movieStyles as s } from './Screen';

function FloatingReaction({ emoji }: { emoji: string }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 2200, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [progress]);
  return <Animated.Text pointerEvents="none" style={{ position: 'absolute', right: 40, bottom: 100, fontSize: 48,
    opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -180] }) }] }}>{emoji}</Animated.Text>;
}
export default function MoviePlayer({ session, file, user, partner, onChangeFile }: { session: WatchSessionRow; file: MovieFile; user: string; partner: string; onChangeFile: () => void }) {
  const watch = useWatch(session, file, user, partner);
  const router = useRouter();
  const [fullscreen, setFullscreen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [drag, setDrag] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const original = useRef<Orientation.OrientationLock | null>(null);
  const orientationBusy = useRef(false);
  useEffect(() => {
    if (!watch.state.notice.startsWith('Partner is')) return;
    setToast(watch.state.notice); const timer = setTimeout(() => setToast(null), 2500); return () => clearTimeout(timer);
  }, [watch.state.notice]);
  useEffect(() => {
    if (!watch.playing || !visible || drag !== null) return;
    const timer = setTimeout(() => setVisible(false), 5000); return () => clearTimeout(timer);
  }, [watch.playing, visible, drag]);
  useEffect(() => () => { if (original.current !== null) void Orientation.lockAsync(original.current).catch(() => {}); }, []);
  async function toggleFullscreen(value: boolean) {
    if (orientationBusy.current) return;
    orientationBusy.current = true;
    try {
      if (value) { original.current = await Orientation.getOrientationLockAsync(); await Orientation.lockAsync(Orientation.OrientationLock.LANDSCAPE); }
      else { await Orientation.lockAsync(original.current ?? Orientation.OrientationLock.DEFAULT); original.current = null; }
      setFullscreen(value); setVisible(true);
    } catch { Alert.alert('Rotation unavailable', 'Allow screen rotation on this phone and try again.'); }
    finally { orientationBusy.current = false; }
  }
  const duration = file.durationMs / 1000;
  function controls() {
    return <View style={styles.overlay} pointerEvents="box-none">
      <Text numberOfLines={1} style={styles.caption}>{session.title ?? file.name}</Text>
      <View style={s.row}>
        <MovieButton label="−10s" disabled={!watch.state.bothReady || watch.state.ended} onPress={() => watch.control('seek', Math.max(0, watch.position - 10))} />
        <MovieButton label={watch.playing ? 'Pause' : 'Play'} disabled={watch.state.ended || (!watch.playing && !watch.state.bothReady)} onPress={() => watch.control(watch.playing ? 'pause' : 'play')} />
        <MovieButton label="+10s" disabled={!watch.state.bothReady || watch.state.ended} onPress={() => watch.control('seek', Math.min(duration, watch.position + 10))} />
      </View>
      <Slider accessibilityLabel="Movie position" minimumValue={0} maximumValue={duration} value={drag ?? watch.position}
        disabled={!watch.state.bothReady || watch.state.ended} minimumTrackTintColor="#EBA5B5" maximumTrackTintColor="#BDAABF" thumbTintColor="#EBA5B5"
        onSlidingStart={value => setDrag(value)} onValueChange={value => setDrag(value)} onSlidingComplete={value => { watch.control('seek', value); setDrag(null); }} />
      <View style={s.row}><Text style={styles.caption}>{time(drag ?? watch.position)} / {time(duration)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={fullscreen ? 'Exit fullscreen' : 'Fullscreen landscape'} onPress={() => { void toggleFullscreen(!fullscreen); }} style={{ padding: 12 }}><Text style={styles.caption}>{fullscreen ? '↙ Exit' : '⛶ Fullscreen'}</Text></Pressable></View>
      <View style={s.row}>{reactions.map(emoji => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`React ${emoji}`} disabled={!watch.state.connected || watch.state.ended} onPress={() => watch.react(emoji)} style={{ padding: 6 }}><Text style={{ fontSize: 26 }}>{emoji}</Text></Pressable>)}</View>
      <Text style={styles.caption}>{watch.state.ended ? 'Session ended' : watch.state.bothReady ? 'Both ready' : watch.state.notice}</Text>
    </View>;
  }
  function video(large: boolean) {
    return <View style={large ? styles.fullVideo : styles.video}>
      <VideoView player={watch.player} nativeControls={false} contentFit="contain" surfaceType="textureView" style={StyleSheet.absoluteFill} />
      <Pressable accessibilityRole="button" accessibilityLabel="Show or hide movie controls" onPress={() => setVisible(v => !v)} style={StyleSheet.absoluteFill} />
      {(visible || !watch.playing) && controls()}
      {toast && <Text pointerEvents="none" style={styles.toast}>{toast}</Text>}
      {watch.reaction && <FloatingReaction key={watch.reaction.id} emoji={watch.reaction.emoji} />}
    </View>;
  }
  return <ScrollView style={s.root}>
    {!fullscreen && video(false)}
    <View style={s.content}>
      <Text style={s.text}>{watch.state.notice}</Text>
      {!watch.state.partnerHere && <View style={s.card}><Text style={s.text}>Waiting for your partner</Text><Text style={s.muted}>You can leave and use Quick return on the Watch tab. Your position stays on this phone.</Text><MovieButton label="Back to Watch · return later" onPress={() => router.replace('/(tabs)/watch')} /></View>}
      <Text style={s.muted}>{watch.state.connected ? 'Connected' : 'Offline'} · {Math.round(watch.state.latency)} ms estimated one way · drift {watch.state.drift.toFixed(2)}s</Text>
      <Text style={s.muted}>Volume and brightness use your phone’s system controls.</Text>
      {watch.error && <Text accessibilityRole="alert" style={s.error}>{watch.error}</Text>}
      {!watch.state.ended && <MovieButton label="Reconnect / retry playback" onPress={watch.reconnect} />}
      <MovieButton label="Choose my local file again" onPress={onChangeFile} />
      {!watch.state.ended && <MovieButton label="End session for both" onPress={() => Alert.alert('End movie session?', 'Your local file and saved position will be kept.', [{ text: 'Cancel', style: 'cancel' }, { text: 'End session', onPress: () => { void watch.end(); } }])} />}
    </View>
    <Modal visible={fullscreen} animationType="fade" supportedOrientations={['landscape']} onRequestClose={() => { void toggleFullscreen(false); }}>
      <StatusBar hidden />{fullscreen && video(true)}
    </Modal>
  </ScrollView>;
}
const styles = StyleSheet.create({
  video: { height: 340, backgroundColor: '#000' }, fullVideo: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#00000080', justifyContent: 'flex-end', padding: 16, gap: 5 },
  caption: { color: '#fff', fontSize: 13 }, toast: { position: 'absolute', alignSelf: 'center', top: 45, backgroundColor: '#302435', padding: 12, borderRadius: 14, color: '#fff' },
});

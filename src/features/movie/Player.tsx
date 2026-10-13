import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { VideoView } from 'expo-video';
import * as Orientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import type { WatchSessionRow } from '@/types/db';
import { matches, reactions, time, type MovieFile } from './model';
import { useWatch } from './useWatch';
import { Header, Screen, Text as ThemeText } from '@/ui';
import { useTheme } from '@/theme';
import { motionTokens, PressableScale, useMotion } from '@/motion';
import { ControlsOverlay, MatchBadge, MovieButton, MovieCard, SeekTrack, SkipButton, StatusChip, WaitingDots, useMovieStyles } from './presentation';

function FloatingReaction({ emoji }: { emoji: string }) {
  const { geometry, spacing, typography } = useTheme(); const motion = useMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: motion.level === 'full' ? motionTokens.particles : motion.duration('fast'), useNativeDriver: true });
    progress.setValue(0); if (motion.level !== 'off') animation.start(); return () => animation.stop();
  }, [progress, motion.level]);
  return <Animated.Text pointerEvents="none" style={{ position: 'absolute', right: spacing.lg, bottom: geometry.touch * 2, fontSize: typography['display/XL'].fontSize,
    opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, motion.level === 'full' ? -geometry.particleTravel : 0] }) }] }}>{emoji}</Animated.Text>;
}
export default function MoviePlayer({ session, file, user, partner, onChangeFile }: { session: WatchSessionRow; file: MovieFile; user: string; partner: string; onChangeFile: () => void }) {
  const s = useMovieStyles(); const { colors, spacing, radius, typography, geometry } = useTheme(); const motion = useMotion();
  const styles = StyleSheet.create({
    video: { aspectRatio: 16 / 9, minHeight: geometry.touch * 8, backgroundColor: colors.shadowColor, borderRadius: radius.lg, overflow: 'hidden' },
    fullVideo: { flex: 1, backgroundColor: colors.shadowColor, justifyContent: 'center' },
    overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'flex-end', padding: spacing.sm, gap: spacing.xs },
    controls: { backgroundColor: colors.bgElevated, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
    caption: { ...typography.caption, color: colors.textPrimary },
    toast: { position: 'absolute', alignSelf: 'center', top: spacing.md, backgroundColor: colors.surface, padding: spacing.s12, borderRadius: radius.pill, color: colors.textPrimary, ...typography['body/S'] },
  });
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
    setToast(watch.state.notice); const timer = setTimeout(() => setToast(null), motionTokens.toast); return () => clearTimeout(timer);
  }, [watch.state.notice]);
  useEffect(() => {
    if (!watch.playing || !visible || drag !== null) return;
    const timer = setTimeout(() => setVisible(false), motionTokens.toast); return () => clearTimeout(timer);
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
  function reactionButtons() {
    return <View style={s.row}>{reactions.map(emoji => <PressableScale key={emoji} accessibilityRole="button" accessibilityLabel={`React ${emoji}`} disabled={!watch.state.connected || watch.state.ended} onPress={() => watch.react(emoji)} style={{ padding: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: typography['title/L'].fontSize }}>{emoji}</Text></PressableScale>)}</View>;
  }
  function controls() {
    return <ControlsOverlay shown={visible || !watch.playing} style={styles.overlay}>
      {fullscreen && <View style={{ position: 'absolute', top: spacing.sm, left: spacing.sm, right: spacing.sm, backgroundColor: colors.bgElevated, borderRadius: radius.md, padding: spacing.sm }}><Header title="Watch together" subtitle={session.title ?? file.name} onBack={() => { void toggleFullscreen(false); }} right={reactionButtons()} /></View>}
      <View style={styles.controls}>
      {!fullscreen && <Text numberOfLines={1} style={styles.caption}>{session.title ?? file.name}</Text>}
      <View style={s.row}>
        <SkipButton label="−10s" disabled={!watch.state.bothReady || watch.state.ended} onPress={() => watch.control('seek', Math.max(0, watch.position - 10))} />
        <MovieButton label={watch.playing ? 'Pause' : 'Play'} disabled={watch.state.ended || (!watch.playing && !watch.state.bothReady)} onPress={() => watch.control(watch.playing ? 'pause' : 'play')} />
        <SkipButton label="+10s" disabled={!watch.state.bothReady || watch.state.ended} onPress={() => watch.control('seek', Math.min(duration, watch.position + 10))} />
      </View>
      <SeekTrack fraction={duration > 0 ? (drag ?? watch.position) / duration : 0} dragging={drag !== null}>
        <Slider accessibilityLabel="Movie position" minimumValue={0} maximumValue={duration} value={drag ?? watch.position}
          disabled={!watch.state.bothReady || watch.state.ended} style={{ minHeight: geometry.touch }} minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor="transparent"
          onSlidingStart={value => setDrag(value)} onValueChange={value => setDrag(value)} onSlidingComplete={value => { watch.control('seek', value); setDrag(null); }} />
      </SeekTrack>
      <View style={s.row}><Text style={styles.caption}>{time(drag ?? watch.position)} / {time(duration)}</Text>
        <PressableScale accessibilityRole="button" accessibilityLabel={fullscreen ? 'Exit fullscreen' : 'Fullscreen landscape'} onPress={() => { void toggleFullscreen(!fullscreen); }} style={{ padding: spacing.sm, justifyContent: 'center' }}><Text style={styles.caption}>{fullscreen ? '↙ Exit' : '⛶ Fullscreen'}</Text></PressableScale></View>
      {!fullscreen && reactionButtons()}
      <StatusChip label={watch.state.ended ? 'Session ended' : watch.state.notice.startsWith('Partner is') ? watch.state.notice : watch.state.bothReady ? 'Both ready' : watch.state.notice} />
      </View>
    </ControlsOverlay>;
  }
  function video(large: boolean) {
    return <View style={large ? styles.fullVideo : styles.video}>
      <VideoView player={watch.player} nativeControls={false} contentFit="contain" surfaceType="textureView" style={StyleSheet.absoluteFill} />
      <PressableScale accessibilityRole="button" accessibilityLabel="Show or hide movie controls" onPress={() => setVisible(v => !v)} style={StyleSheet.absoluteFill} />
      {controls()}
      {toast && <Text pointerEvents="none" style={styles.toast}>{toast}</Text>}
      {watch.reaction && <FloatingReaction key={watch.reaction.id} emoji={watch.reaction.emoji} />}
    </View>;
  }
  return <ScrollView style={s.root}>
    {!fullscreen && <><Header title="Watch together" subtitle="TOGETHER, IN SYNC" onBack={() => router.back()} /><ThemeText variant="display/M" style={{ marginBottom: spacing.md }}>Press play on us.</ThemeText>{video(false)}</>}
    <View style={[s.content, { paddingTop: spacing.md }]}>
      <Text style={s.text}>{watch.state.notice}</Text>
      {!watch.state.partnerHere && <View style={s.card}><View style={s.row}><Text style={s.text}>Waiting for your partner</Text><WaitingDots /></View><Text style={s.muted}>You can leave and use Quick return on the Watch tab. Your position stays on this phone.</Text><MovieButton label="Back to Watch · return later" onPress={() => router.replace('/(tabs)/watch')} /></View>}
      {!watch.state.connected && <ThemeText color="warning" accessibilityLiveRegion="polite">Offline · Reconnect to restore shared playback.</ThemeText>}
      <MovieCard file={file} title={file.name} size={file.size} durationMs={file.durationMs} />
      {matches(file, session) && <MatchBadge />}
      <Text style={s.muted}>{watch.state.connected ? 'Connected' : 'Offline'} · {Math.round(watch.state.latency)} ms estimated one way · drift {watch.state.drift.toFixed(2)}s</Text>
      <Text style={s.muted}>Volume and brightness use your phone’s system controls.</Text>
      {watch.error && <Text accessibilityRole="alert" style={s.error}>{watch.error}</Text>}
      {!watch.state.ended && <MovieButton secondary label="Reconnect / retry playback" onPress={watch.reconnect} />}
      <MovieButton secondary label="Choose my local file again" onPress={onChangeFile} />
      {!watch.state.ended && <MovieButton secondary label="End session for both" onPress={() => Alert.alert('End movie session?', 'Your local file and saved position will be kept.', [{ text: 'Cancel', style: 'cancel' }, { text: 'End session', onPress: () => { void watch.end(); } }])} />}
    </View>
    <Modal visible={fullscreen} animationType={motion.level === 'off' ? 'none' : 'fade'} supportedOrientations={['landscape']} onRequestClose={() => { void toggleFullscreen(false); }}>
      <Screen style={{ padding: spacing.sm }}><StatusBar hidden />{fullscreen && video(true)}</Screen>
    </Modal>
  </ScrollView>;
}

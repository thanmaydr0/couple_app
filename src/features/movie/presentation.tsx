import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Image, StyleSheet, View, type ViewProps } from 'react-native';
import Animated, { cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import * as Thumbnails from 'expo-video-thumbnails';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme';
import { motionTokens, PressableScale, useMotion } from '@/motion';
import { Button, Text } from '@/ui';
import { time, type MovieFile } from './model';

// Feature-local presentation only. No session reads or playback side effects.
export function useMovieStyles() {
  const { colors, spacing, radius, typography, geometry } = useTheme();
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { gap: spacing.md, paddingBottom: spacing.s40 },
    title: { ...typography['display/M'], color: colors.textPrimary },
    text: { ...typography['body/M'], color: colors.textPrimary },
    muted: { ...typography['body/S'], color: colors.textSecondary },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: geometry.hairline, borderRadius: radius.lg, padding: spacing.md, gap: spacing.s12 },
    error: { ...typography['body/S'], color: colors.danger },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  });
}

export function MovieButton({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Button title={label} onPress={onPress} disabled={disabled} variant={secondary ? 'secondary' : 'primary'} />;
}

export function MovieEntrance({ children, style, shake = false, animate = true }: PropsWithChildren<{ style?: ViewProps['style']; shake?: boolean; animate?: boolean }>) {
  const motion = useMotion(); const progress = useSharedValue(1); const offset = useSharedValue(0);
  useEffect(() => {
    offset.value = 0;
    progress.value = motion.level === 'off' || !animate ? 1 : 0;
    if (animate && motion.level !== 'off') progress.value = motion.level === 'full' && !shake ? withSpring(1, motion.spring('gentle')) : withTiming(1, { duration: motion.duration('fast') });
    if (shake && motion.level === 'full') offset.value = withSequence(withTiming(-motionTokens.travel, { duration: motion.duration('instant') }), withTiming(motionTokens.travel, { duration: motion.duration('instant') }), withTiming(0, { duration: motion.duration('fast') }));
    return () => { cancelAnimation(progress); cancelAnimation(offset); };
  }, [motion.level, shake, animate, progress, offset]);
  const animated = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.value), transform: [{ translateY: motion.level === 'full' && !shake ? -motionTokens.travel * (1 - progress.value) : 0 }, { translateX: offset.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

export function MovieCard({ file, title, size, durationMs }: { file?: MovieFile; title: string; size?: number | null; durationMs?: number | null }) {
  const { colors, spacing, radius, geometry } = useTheme(); const [thumbnail, setThumbnail] = useState<string | null>(null);
  useEffect(() => {
    let active = true; setThumbnail(null);
    if (file) void Thumbnails.getThumbnailAsync(file.uri).then(result => { if (active) setThumbnail(result.uri); }).catch(() => {});
    return () => { active = false; };
  }, [file?.uri]);
  return <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, overflow: 'hidden' }}>
    {file && <View style={{ aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgElevated }}>
      {thumbnail ? <Image accessibilityLabel={`Preview of ${title}`} source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} /> : <><Ionicons name="film-outline" size={geometry.touch} color={colors.primary} /><Text variant="caption" color="textSecondary">Local video · preview unavailable</Text></>}
    </View>}
    <View style={{ padding: spacing.md, gap: spacing.sm }}><Text variant="caption" color="textSecondary">ON YOUR OWN PHONES</Text><Text variant="title/S">{title}</Text><Text variant="body/S" color="textSecondary">{size?.toLocaleString() ?? 'Unknown'} bytes · {time((durationMs ?? 0) / 1000)}</Text></View>
  </View>;
}

export function WaitingDots() {
  const { colors, spacing, geometry, radius } = useTheme(); const motion = useMotion(); const progress = useSharedValue(1);
  useEffect(() => { progress.value = 1; if (motion.level === 'full') progress.value = withRepeat(withTiming(geometry.disabledOpacity, { duration: motion.duration('pulse') }), -1, true); return () => cancelAnimation(progress); }, [motion.level, progress]);
  const animated = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View accessible accessibilityLabel="Waiting for partner" style={[{ flexDirection: 'row', gap: spacing.xs }, animated]}>{[0, 1, 2].map(index => <View key={index} style={{ width: geometry.dot, height: geometry.dot, borderRadius: radius.pill, backgroundColor: colors.textSecondary }} />)}</Animated.View>;
}

export function SkipButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  const { colors, spacing, geometry, radius } = useTheme(); const motion = useMotion(); const pulse = useSharedValue(1);
  useEffect(() => () => cancelAnimation(pulse), [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: 1 - pulse.value, transform: [{ scale: 1 + pulse.value * geometry.parallax }] }));
  return <PressableScale accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => {
    if (motion.level === 'full') { pulse.value = 0; pulse.value = withTiming(1, { duration: motion.duration('slow') }); }
    onPress();
  }} style={{ minWidth: geometry.touch, minHeight: geometry.touch, padding: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: geometry.stroke, borderColor: colors.primary, borderRadius: radius.pill }, animated]} /><Text variant="label">{label}</Text>
  </PressableScale>;
}

export function ControlsOverlay({ shown, children, style }: PropsWithChildren<{ shown: boolean; style: ViewProps['style'] }>) {
  const motion = useMotion(); const progress = useSharedValue(shown ? 1 : 0);
  useEffect(() => { progress.value = withTiming(shown ? 1 : 0, { duration: motion.duration('fast') }); return () => cancelAnimation(progress); }, [shown, motion.level, progress]);
  const animated = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: motion.level === 'full' ? (1 - progress.value) * motionTokens.travel : 0 }] }));
  return <Animated.View pointerEvents={shown ? 'box-none' : 'none'} accessibilityElementsHidden={!shown} importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'} style={[style, animated]}>{children}</Animated.View>;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
export function MatchBadge() {
  const { colors, geometry, spacing } = useTheme(); const motion = useMotion(); const progress = useSharedValue(0);
  useEffect(() => { progress.value = motion.level === 'full' ? 0 : 1; if (motion.level === 'full') progress.value = withTiming(1, { duration: motion.duration('slow') }); return () => cancelAnimation(progress); }, [motion.level, progress]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: geometry.receiptLength * (1 - progress.value) }));
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><Svg width={geometry.receipt} height={geometry.receipt} viewBox="0 0 24 24" accessible={false}><AnimatedPath d="M4 12 L9 17 L20 6" stroke={colors.success} strokeWidth={geometry.stroke} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={geometry.receiptLength} animatedProps={animatedProps} /></Svg><Text variant="body/S" color="success" style={{ flex: 1 }}>File verified · size and duration match</Text></View>;
}

export function SeekTrack({ fraction, dragging, children }: PropsWithChildren<{ fraction: number; dragging: boolean }>) {
  const { colors, geometry, radius } = useTheme(); const motion = useMotion(); const scale = useSharedValue(1);
  useEffect(() => { scale.value = motion.level === 'full' ? withSpring(dragging ? 1 + geometry.parallax : 1, motion.spring('snappy')) : 1; return () => cancelAnimation(scale); }, [dragging, motion.level, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: -geometry.thumb / 2 }, { scale: scale.value }] }));
  return <View style={{ minHeight: geometry.touch, justifyContent: 'center' }}>{children}<View pointerEvents="none" style={{ position: 'absolute', top: (geometry.touch - geometry.thumb) / 2, left: geometry.thumb / 2, right: geometry.thumb / 2, height: geometry.thumb }}><Animated.View style={[{ position: 'absolute', left: `${Math.max(0, Math.min(1, fraction)) * 100}%`, width: geometry.thumb, height: geometry.thumb, borderRadius: radius.pill, backgroundColor: colors.primary }, animated]} /></View></View>;
}

export function StatusChip({ label }: { label: string }) {
  const { colors, spacing, radius } = useTheme(); const motion = useMotion(); const last = useRef(label); const [previous, setPrevious] = useState(label); const progress = useSharedValue(1);
  useEffect(() => {
    setPrevious(last.current); last.current = label;
    progress.value = motion.level === 'off' ? 1 : 0;
    progress.value = withTiming(1, { duration: motion.duration('fast') });
    return () => cancelAnimation(progress);
  }, [label, motion.level, progress]);
  const incoming = useAnimatedStyle(() => ({ opacity: progress.value }));
  const outgoing = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: spacing.s12, paddingVertical: spacing.xs }}><Animated.View style={incoming}><Text variant="caption">{label}</Text></Animated.View><Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ position: 'absolute', left: spacing.s12, top: spacing.xs }, outgoing]}><Text variant="caption">{previous}</Text></Animated.View></View>;
}

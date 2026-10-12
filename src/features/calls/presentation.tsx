import { useEffect, useState, type ComponentProps, type PropsWithChildren } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';
import { DriftingGradient, FadeInView, PressableScale, motionTokens, useMotion } from '@/motion';

/** UI-only chrome visibility. Call state and media are never delayed. */
export function CallChrome({ hide, children }: PropsWithChildren<{ hide: boolean }>) {
  const motion = useMotion();
  const [visible, setVisible] = useState(true);
  const [screenReader, setScreenReader] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!hide || screenReader) { setVisible(true); return; }
    if (!visible) return;
    // Four seconds, expressed in the shared duration scale.
    const timer = setTimeout(() => setVisible(false), motionTokens.fast * 25);
    return () => clearTimeout(timer);
  }, [hide, visible, screenReader]);
  const progress = useSharedValue(1);
  useEffect(() => { progress.value = withTiming(visible ? 1 : 0, { duration: motion.duration('fast') }); }, [visible, motion.level, progress]);
  const animated = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: motion.level === 'full' ? (1 - progress.value) * motionTokens.travel : 0 }] }));
  return <View pointerEvents="box-none" style={{ flex: 1 }}>
    {hide && <PressableScale haptic={false} accessibilityRole="button" accessibilityLabel="Show call controls" onPress={() => setVisible(value => !value)} style={StyleSheet.absoluteFill} />}
    <Animated.View pointerEvents={visible ? 'box-none' : 'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={[{ flex: 1, justifyContent: 'space-between' }, animated]}>{children}</Animated.View>
  </View>;
}
export function CallBackdrop() {
  const { colors } = useTheme();
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}><LinearGradient colors={[colors.bg, colors.surface, colors.bg]} style={StyleSheet.absoluteFill} /><DriftingGradient /></View>;
}
export function useCallStyles() {
  const { colors: c, spacing: s, radius: r, geometry: g, typography: t } = useTheme();
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg }, safe: { flex: 1, justifyContent: 'space-between' },
    callHeader: { paddingHorizontal: s.lg, paddingTop: s.md }, headerCard: { padding: s.md, borderRadius: r.lg, backgroundColor: c.bgElevated },
    eyebrow: { ...t.caption, color: c.textSecondary, textAlign: 'center' }, status: { ...t['title/M'], color: c.textPrimary, textAlign: 'center', fontVariant: ['tabular-nums'] },
    identity: { alignItems: 'center', gap: s.lg, padding: s.lg, flex: 1, justifyContent: 'center' },
    avatar: { height: g.avatar * 3, width: g.avatar * 3, borderRadius: r.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt, overflow: 'hidden', borderWidth: g.hairline, borderColor: c.border },
    avatarImage: { height: '100%', width: '100%' }, initial: { ...t['display/XL'], color: c.primary },
    name: { ...t['display/M'], color: c.textPrimary, textAlign: 'center' }, subtitle: { ...t['body/S'], color: c.textSecondary, textAlign: 'center' },
    reconnecting: { alignSelf: 'center', padding: s.md, borderRadius: r.lg, backgroundColor: c.bgElevated, gap: s.sm, borderWidth: g.hairline, borderColor: c.border },
    bottom: { padding: s.md, gap: s.md, backgroundColor: c.bgElevated, borderRadius: r.sheet, margin: s.lg },
    controls: { flexDirection: 'row', justifyContent: 'space-evenly', gap: s.xs, flexWrap: 'wrap' },
    controlWrap: { alignItems: 'center', gap: s.sm, minWidth: g.touch },
    control: { width: s.s56, height: s.s56, borderRadius: r.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt, borderWidth: g.hairline, borderColor: c.border },
    selected: { backgroundColor: c.primary, borderColor: c.primary }, danger: { backgroundColor: c.danger, borderColor: c.danger },
    controlLabel: { ...t.caption, color: c.textPrimary }, routeLabel: { ...t.caption, color: c.textSecondary, textAlign: 'center' }, debug: { ...t.caption, color: c.textSecondary, textAlign: 'center' },
    preview: { position: 'absolute', left: 0, top: 0, width: g.avatar * 2 + s.lg, height: g.avatar * 3 + s.lg, backgroundColor: c.surfaceAlt, borderWidth: g.stroke, borderColor: c.border, borderRadius: r.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    previewLabel: { ...t.caption, position: 'absolute', bottom: s.sm, left: s.sm, color: c.textPrimary, backgroundColor: c.bgElevated, padding: s.xs, borderRadius: r.sm },
    error: { ...t['body/S'], color: c.danger, textAlign: 'center' }, page: { paddingVertical: s.md, gap: s.lg }, pageTitle: { ...t['display/M'], color: c.textPrimary },
    startButtons: { flexDirection: 'row', gap: s.s12 }, startButton: { flex: 1, backgroundColor: c.primary, padding: s.md, borderRadius: r.lg, gap: s.sm, alignItems: 'center', minHeight: g.touch },
    startLabel: { ...t.label, color: c.primaryContrast }, disabled: { opacity: g.disabledOpacity }, link: { ...t.label, color: c.primary, textAlign: 'center', padding: s.s12 },
  });
}

export function CallDots() {
  const { spacing, geometry, colors, radius } = useTheme(); const motion = useMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    if (motion.level === 'full') progress.value = withRepeat(withTiming(1, { duration: motion.duration('pulse') }), -1, true);
    return () => cancelAnimation(progress);
  }, [motion.level, progress]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - progress.value * 0.6 }));
  return <Animated.View accessible accessibilityLabel="Calling" style={[{ flexDirection: 'row', gap: spacing.xs }, style]}>{[0, 1, 2].map(dot => <View key={dot} style={{ width: geometry.dot, height: geometry.dot, borderRadius: radius.pill, backgroundColor: colors.primary }} />)}</Animated.View>;
}
export function CallIcon({ icon, highlighted, turn }: { icon: ComponentProps<typeof Ionicons>['name']; highlighted: boolean; turn: number }) {
  const { colors, geometry } = useTheme(); const motion = useMotion();
  const rotation = useSharedValue(turn);
  useEffect(() => { rotation.value = withTiming(turn, { duration: motion.duration('base') }); }, [turn, motion.level, rotation]);
  const animated = useAnimatedStyle(() => ({ transform: [{ rotate: `${motion.level === 'full' ? rotation.value * 180 : 0}deg` }] }));
  return <Animated.View style={animated}><FadeInView key={icon}><Ionicons name={icon} size={geometry.icon} color={highlighted ? colors.primaryContrast : colors.textPrimary} /></FadeInView></Animated.View>;
}

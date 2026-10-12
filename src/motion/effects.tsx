import { Children, useEffect, type PropsWithChildren } from 'react';
import { TextInput, View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedProps, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { useTheme } from '../theme/ThemeProvider';
import { geometry, radius, spacing, typography } from '../theme/tokens';
import { useMotion } from './useMotion';
import { motionTokens } from './tokens';

export function FadeInView({ delay = 0, style, ...props }: ViewProps & { delay?: number }) {
  const motion = useMotion(); const value = useSharedValue(motion.level === 'off' ? 1 : 0);
  useEffect(() => { if (motion.level === 'off') value.value = 1; else { value.value = 0; value.value = withDelay(motion.level === 'full' ? delay : 0, withTiming(1, { duration: motion.duration('base') })); } return () => cancelAnimation(value); }, [motion.level, delay, value]);
  const animated = useAnimatedStyle(() => ({ opacity: value.value, transform: [{ translateY: motion.level === 'full' ? (1 - value.value) * motionTokens.travel : 0 }] }));
  return <Animated.View {...props} style={[style, animated]} />;
}
export function StaggerList({ children, firstScreenful = geometry.firstScreenful, ...props }: PropsWithChildren<ViewProps & { firstScreenful?: number }>) {
  return <View {...props}>{Children.map(children, (child, index) => index < firstScreenful ? <FadeInView delay={index * motionTokens.stagger}>{child}</FadeInView> : child)}</View>;
}
function useLoop(duration: 'shimmer' | 'pulse' | 'heartbeat' | 'drift') {
  const motion = useMotion(); const value = useSharedValue(0);
  useEffect(() => { cancelAnimation(value); value.value = 0; if (motion.level === 'full') value.value = withRepeat(withTiming(1, { duration: motion.duration(duration) }), -1, true); return () => cancelAnimation(value); }, [motion.level, duration, value]);
  return { value, level: motion.level };
}
export function Skeleton({ width = '100%', height = geometry.touch, style }: { width?: ViewStyle['width']; height?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme(); const { value, level } = useLoop('shimmer');
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: (value.value * 2 - 1) * geometry.particleTravel }] }));
  return <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading" style={[{ width, height, overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.surfaceAlt }, style]}>
    {level === 'full' && <Animated.View importantForAccessibility="no-hide-descendants" style={[{ width: '100%', height: '100%' }, animated]}><LinearGradient colors={[colors.surfaceAlt, colors.surface, colors.surfaceAlt]} style={{ flex: 1 }} /></Animated.View>}
  </View>;
}
export function PulseRing({ size = spacing.s56, children, style }: PropsWithChildren<{ size?: number; style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme(); const { value, level } = useLoop('pulse');
  const animated = useAnimatedStyle(() => ({ opacity: level === 'full' ? 1 - value.value * 0.7 : 1, transform: [{ scale: level === 'full' ? 1 + value.value * 0.15 : 1 }] }));
  return <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}><Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: radius.pill, borderWidth: geometry.stroke, borderColor: colors.primary }, animated]} />{children}</View>;
}
export function HeartbeatView({ style, ...props }: ViewProps) {
  const { value, level } = useLoop('heartbeat');
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: level === 'full' ? 1 + Math.sin(value.value * Math.PI) * 0.04 : 1 }] }));
  return <Animated.View {...props} style={[style, animated]} />;
}
export function ParallaxHeader({ scrollY, style, ...props }: ViewProps & { scrollY: SharedValue<number> }) {
  const { level } = useMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: level === 'full' ? Math.max(0, scrollY.value) * geometry.parallax : 0 }] }));
  return <Animated.View {...props} style={[style, animated]} />;
}
const AnimatedInput = Animated.createAnimatedComponent(TextInput);
export function AnimatedNumber({ value, style, accessibilityLabel }: { value: number; style?: import('react-native').TextStyle; accessibilityLabel?: string }) {
  const motion = useMotion(); const count = useSharedValue(value);
  useEffect(() => { count.value = motion.level === 'full' ? withTiming(value, { duration: motion.duration('count') }) : value; }, [value, motion.level, count]);
  const props = useAnimatedProps(() => ({ text: String(Math.round(count.value)), defaultValue: String(Math.round(count.value)) }));
  const { colors } = useTheme();
  return <AnimatedInput editable={false} accessible accessibilityLabel={accessibilityLabel ?? String(value)} underlineColorAndroid="transparent" animatedProps={props} style={[typography['title/L'], { color: colors.textPrimary, fontVariant: ['tabular-nums'], padding: 0 }, style]} />;
}
function Particle({ progress, index, color }: { progress: SharedValue<number>; index: number; color: string }) {
  // Deterministic positions keep rendering stable across rerenders.
  const angle = index * 2.39996; const distance = geometry.particleTravel * (0.4 + (index % 7) / 10);
  // Skia reads these UI-thread derived values directly.
  const x = useDerivedParticle(progress, Math.cos(angle) * distance, false);
  const y = useDerivedParticle(progress, Math.sin(angle) * distance, true);
  const opacity = useParticleOpacity(progress);
  return <Circle cx={x} cy={y} r={geometry.particle} color={color} opacity={opacity} />;
}
function useDerivedParticle(progress: SharedValue<number>, distance: number, gravity: boolean) {
  return useDerivedValue(() => geometry.particleTravel + distance * progress.value + (gravity ? spacing.s56 * progress.value * progress.value : 0));
}
function useParticleOpacity(progress: SharedValue<number>) { return useDerivedValue(() => 1 - progress.value); }
export function Burst({ trigger, count = geometry.maxParticles }: { trigger: number; count?: number }) {
  const motion = useMotion(); const { colors } = useTheme(); const progress = useSharedValue(1);
  useEffect(() => { cancelAnimation(progress); progress.value = 1; if (motion.level === 'full' && trigger > 0) { progress.value = 0; progress.value = withTiming(1, { duration: motion.duration('particles') }); } }, [trigger, motion.level, progress]);
  if (motion.level !== 'full') return null;
  return <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={{ width: geometry.particleTravel * 2, height: geometry.particleTravel * 2 }}><Canvas style={{ flex: 1 }}>{Array.from({ length: Math.max(0, Math.min(60, Math.floor(count))) }, (_, i) => <Particle key={i} index={i} progress={progress} color={i % 2 ? colors.primary : colors.accent} />)}</Canvas></View>;
}
export function DriftingGradient() {
  const { colors } = useTheme(); const { value, level } = useLoop('drift');
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: value.value * motionTokens.travel }] }));
  if (level !== 'full') return null;
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -spacing.md, bottom: -spacing.md, left: 0, right: 0 }, animated]}><LinearGradient colors={[colors.bg, colors.surface, colors.bg]} style={{ flex: 1 }} /></Animated.View>;
}

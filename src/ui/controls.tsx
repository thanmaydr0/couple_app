import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../theme';
import { useMotion } from '../motion/useMotion';
import { PressableScale } from '../motion/PressableScale';
import { Text } from './Text';
export function Chip({ label, selected = false, disabled = false, onPress }: { label: string; selected?: boolean; disabled?: boolean; onPress?: () => void }) {
  const { colors, spacing, radius, geometry } = useTheme();
  return <PressableScale accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={{ borderRadius: radius.pill, borderWidth: geometry.hairline, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center' }}><Text variant="label" color={selected ? 'primaryContrast' : 'textPrimary'}>{label}</Text></PressableScale>;
}
export function SegmentedControl<T extends string>({ options, value, onChange, disabled }: { options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void; disabled?: boolean }) {
  const { colors, spacing, radius } = useTheme();
  return <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt, padding: spacing.xs }}>{options.map(option => <PressableScale key={option.value} disabled={disabled} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: option.value === value }} onPress={() => onChange(option.value)} style={{ flexGrow: 1, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: option.value === value ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Text variant="label" color={option.value === value ? 'primaryContrast' : 'textPrimary'}>{option.label}</Text></PressableScale>)}</View>;
}
export function Switch({ value, onValueChange, disabled, accessibilityLabel }: { value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean; accessibilityLabel: string }) {
  const { colors, geometry, spacing, radius } = useTheme(); const motion = useMotion(); const position = useSharedValue(value ? 1 : 0);
  useEffect(() => { position.value = motion.level === 'full' ? withSpring(value ? 1 : 0, motion.spring('snappy')) : value ? 1 : 0; }, [value, motion.level, position]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * (geometry.switchWidth - geometry.switchThumb - spacing.xs * 2) }] }));
  return <PressableScale disabled={disabled} accessibilityRole="switch" accessibilityLabel={accessibilityLabel} accessibilityState={{ checked: value }} onPress={() => onValueChange(!value)} style={{ alignItems: 'center', justifyContent: 'center' }}><View style={{ width: geometry.switchWidth, height: geometry.switchHeight, padding: spacing.xs, borderRadius: radius.pill, backgroundColor: value ? colors.primary : colors.border }}><Animated.View style={[{ width: geometry.switchThumb, height: geometry.switchThumb, borderRadius: radius.pill, backgroundColor: value ? colors.primaryContrast : colors.bgElevated }, animated]} /></View></PressableScale>;
}
export function Slider({ value, onValueChange, minimumValue = 0, maximumValue = 1, step = 0, disabled = false, accessibilityLabel }: { value: number; onValueChange: (value: number) => void; minimumValue?: number; maximumValue?: number; step?: number; disabled?: boolean; accessibilityLabel: string }) {
  const { colors, geometry, radius } = useTheme(); const [width, setWidth] = useState<number>(geometry.touch); const range = Math.max(Number.EPSILON, maximumValue - minimumValue);
  const progress = useSharedValue(Math.max(0, Math.min(1, (value - minimumValue) / range))); const start = useSharedValue(0);
  useEffect(() => { progress.value = Math.max(0, Math.min(1, (value - minimumValue) / range)); }, [value, minimumValue, range, progress]);
  const apply = (fraction: number) => { const raw = minimumValue + fraction * range; onValueChange(Math.max(minimumValue, Math.min(maximumValue, step > 0 ? minimumValue + Math.round((raw - minimumValue) / step) * step : raw))); };
  const gesture = Gesture.Pan().enabled(!disabled).onBegin(() => { start.value = progress.value; }).onUpdate(event => { progress.value = Math.max(0, Math.min(1, start.value + event.translationX / Math.max(1, width - geometry.thumb))); scheduleOnRN(apply, progress.value); });
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * (width - geometry.thumb) }] }));
  const fill = useAnimatedStyle(() => ({ width: Math.max(geometry.thumb / 2, progress.value * (width - geometry.thumb) + geometry.thumb / 2) }));
  return <GestureDetector gesture={gesture}><View accessible accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} accessibilityValue={{ min: minimumValue, max: maximumValue, now: value }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={e => { if (!disabled) apply(progress.value + (e.nativeEvent.actionName === 'increment' ? 1 : -1) * (step > 0 ? step / range : 0.1)); }} onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ minHeight: geometry.touch, justifyContent: 'center', opacity: disabled ? geometry.disabledOpacity : 1 }}><View style={{ height: geometry.track, borderRadius: radius.pill, backgroundColor: colors.border }}><Animated.View style={[{ height: geometry.track, borderRadius: radius.pill, backgroundColor: colors.primary }, fill]} /></View><Animated.View style={[{ position: 'absolute', width: geometry.thumb, height: geometry.thumb, borderRadius: radius.pill, borderColor: colors.primary, borderWidth: geometry.stroke, backgroundColor: colors.bgElevated }, thumb]} /></View></GestureDetector>;
}
export function Badge({ children, label }: { children: ReactNode; label?: string }) {
  const { colors, radius, spacing } = useTheme(); const motion = useMotion(); const scale = useSharedValue(1);
  useEffect(() => { if (motion.level === 'full') { scale.value = 0.8; scale.value = withSpring(1, motion.spring('bouncy')); } else scale.value = 1; }, [children, motion.level, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View accessible accessibilityLabel={label} style={[{ alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.primary }, animated]}><Text variant="caption" color="primaryContrast">{children}</Text></Animated.View>;
}

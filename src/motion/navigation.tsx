import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useMotion } from './useMotion';
import { PressableScale } from './PressableScale';
import { Text } from '../ui/Text';
import { Badge } from '../ui/controls';
export function useStackTransition(presentation: 'screen' | 'modal' = 'screen') {
  const motion = useMotion();
  const animation: 'none' | 'fade' | 'slide_from_bottom' | 'slide_from_right' = motion.level === 'off' ? 'none' : motion.level === 'reduced' ? 'fade' : presentation === 'modal' ? 'slide_from_bottom' : 'slide_from_right';
  return { animation, animationDuration: motion.duration('base') };
}
export type TabItem = { key: string; label: string; icon: (active: boolean) => ReactNode; badge?: number; accessibilityLabel?: string };
function Tab({ item, active, onPress, onLongPress }: { item: TabItem; active: boolean; onPress: () => void; onLongPress?: () => void }) {
  const { spacing } = useTheme(); const motion = useMotion(); const bounce = useSharedValue(1);
  useEffect(() => { if (active && motion.level === 'full') { bounce.value = 0.85; bounce.value = withSpring(1, motion.spring('bouncy')); } else bounce.value = 1; }, [active, motion.level, bounce]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] }));
  return <PressableScale accessibilityRole="tab" accessibilityLabel={item.accessibilityLabel ?? item.label} accessibilityState={{ selected: active }} onPress={onPress} onLongPress={onLongPress} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, gap: spacing.xs }}><Animated.View style={animated}>{item.icon(active)}</Animated.View><Text variant="caption" color={active ? 'primaryContrast' : 'textSecondary'}>{item.label}</Text>{!!item.badge && <View style={{ position: 'absolute', right: 0, top: 0 }}><Badge label={`${item.badge} unread`}>{item.badge}</Badge></View>}</PressableScale>;
}
/** Standalone integration API: Home owns the router tab-bar adapter. */
export function AnimatedBottomTabBar({ tabs, activeKey, onTabPress, onTabLongPress }: { tabs: readonly TabItem[]; activeKey: string; onTabPress: (key: string) => void; onTabLongPress?: (key: string) => void }) {
  const { colors, spacing, radius } = useTheme(); const motion = useMotion(); const insets = useSafeAreaInsets(); const [width, setWidth] = useState(0); const x = useSharedValue(0); const fade = useSharedValue(1);
  const count = Math.max(1, tabs.length); const cell = width / count; const index = Math.max(0, tabs.findIndex(t => t.key === activeKey));
  useEffect(() => { if (motion.level === 'full') x.value = withSpring(index * cell, motion.spring('snappy')); else { x.value = index * cell; fade.value = 0; fade.value = withTiming(1, { duration: motion.duration('fast') }); } }, [index, cell, motion.level, x, fade]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: fade.value }));
  return <View style={{ marginHorizontal: spacing.md, marginBottom: Math.max(insets.bottom, spacing.sm), padding: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElevated }}><View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row' }}><Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, width: cell, borderRadius: radius.pill, backgroundColor: colors.primary }, animated]} />{tabs.map(item => <Tab key={item.key} item={item} active={activeKey === item.key} onPress={() => onTabPress(item.key)} onLongPress={() => onTabLongPress?.(item.key)} />)}</View></View>;
}

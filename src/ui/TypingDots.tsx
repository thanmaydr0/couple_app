import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { useMotion } from '../motion/useMotion';
import { motionTokens } from '../motion/tokens';
function Dot({ index }: { index: number }) {
  const { colors, geometry, radius } = useTheme(); const motion = useMotion(); const value = useSharedValue(1);
  useEffect(() => { cancelAnimation(value); value.value = 1; if (motion.level === 'full') value.value = withDelay(index * motionTokens.fast, withRepeat(withTiming(0.35, { duration: motion.duration('slow') }), -1, true)); return () => cancelAnimation(value); }, [motion.level, index, value]);
  const animated = useAnimatedStyle(() => ({ opacity: value.value }));
  return <Animated.View style={[{ width: geometry.dot, height: geometry.dot, borderRadius: radius.pill, backgroundColor: colors.textSecondary }, animated]} />;
}
export function TypingDots() {
  const { spacing } = useTheme();
  return <View accessible accessibilityLabel="Partner is typing" style={{ flexDirection: 'row', gap: spacing.xs, padding: spacing.sm }}><Dot index={0} /><Dot index={1} /><Dot index={2} /></View>;
}

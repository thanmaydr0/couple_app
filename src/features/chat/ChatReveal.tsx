import { useEffect, type PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { motionTokens, useMotion } from '@/motion';

export function ChatReveal({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const motion = useMotion();
  const progress = useSharedValue(motion.level === 'off' ? 1 : 0);
  useEffect(() => {
    progress.value = motion.level === 'full' ? withSpring(1, motion.spring('snappy')) : withTiming(1, { duration: motion.duration('fast') });
  }, [motion.level, progress]);
  const animated = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: motion.level === 'full' ? motionTokens.pressScale + (1 - motionTokens.pressScale) * progress.value : 1 }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

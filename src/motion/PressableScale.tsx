import { useEffect, useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMotion } from './useMotion';
import { motionTokens } from './tokens';
import { geometry } from '../theme/tokens';
import type { useThemeStyle } from '../theme/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export type PressableScaleProps = PressableProps & { haptic?: boolean; themeStyle?: ReturnType<typeof useThemeStyle> };
export function PressableScale({ style, themeStyle, onPressIn, onPressOut, disabled, haptic = true, ...props }: PressableScaleProps) {
  const motion = useMotion();
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1); const opacity = useSharedValue(1);
  useEffect(() => { if (motion.level !== 'full') scale.value = 1; }, [motion.level, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: disabled ? geometry.disabledOpacity : opacity.value }));
  return <AnimatedPressable {...props} disabled={disabled} accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
    style={[{ minHeight: geometry.touch, minWidth: geometry.touch }, themeStyle, typeof style === 'function' ? style({ pressed }) : style, animated]}
    onPressIn={event => {
      setPressed(true);
      if (motion.level === 'full') scale.value = withSpring(motionTokens.pressScale, motion.spring('snappy'));
      else opacity.value = withTiming(0.75, { duration: motion.duration('fast') });
      if (haptic && motion.level === 'full') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onPressIn?.(event);
    }} onPressOut={event => { setPressed(false); scale.value = motion.level === 'full' ? withSpring(1, motion.spring('snappy')) : 1; opacity.value = withTiming(1, { duration: motion.duration('fast') }); onPressOut?.(event); }} />;
}

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { useMotion } from './useMotion';
import { motionTokens } from './tokens';
import { geometry } from '../theme/tokens';
import type { useThemeStyle } from '../theme/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export type PressableScaleProps = PressableProps & {
  haptic?: boolean;
  sheen?: boolean;
  themeStyle?: ReturnType<typeof useThemeStyle>;
};

export function PressableScale({
  style,
  themeStyle,
  onPressIn,
  onPressOut,
  disabled,
  haptic = true,
  sheen = true,
  children,
  ...props
}: PressableScaleProps) {
  const motion = useMotion();
  const { dark } = useTheme();
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (motion.level !== 'full') {
      scale.value = 1;
      glow.value = 0;
    }
  }, [motion.level, scale, glow]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? geometry.disabledOpacity : opacity.value,
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: glow.value * (dark ? 0.09 : 0.05),
  }));

  const hasDynamicChildren = typeof children === 'function';
  const hasSheen = sheen && !hasDynamicChildren;

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
      style={[
        { minHeight: geometry.touch, minWidth: geometry.touch },
        themeStyle,
        typeof style === 'function' ? style({ pressed }) : style,
        animated,
      ]}
      onPressIn={event => {
        if (typeof style === 'function') setPressed(true);
        if (motion.level === 'full') {
          scale.value = withSpring(motionTokens.pressScale, motion.spring('snappy'));
          if (hasSheen) glow.value = withTiming(1, { duration: motionTokens.instant });
        } else {
          opacity.value = withTiming(0.75, { duration: motion.duration('fast') });
        }
        if (haptic && motion.level === 'full') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPressIn?.(event);
      }}
      onPressOut={event => {
        if (typeof style === 'function') setPressed(false);
        if (motion.level === 'full') {
          scale.value = withSpring(1, motion.spring('bouncy'));
          if (hasSheen) glow.value = withTiming(0, { duration: motionTokens.fast });
        } else {
          scale.value = 1;
          opacity.value = withTiming(1, { duration: motion.duration('fast') });
        }
        onPressOut?.(event);
      }}
    >
      {hasDynamicChildren ? (
        children
      ) : (
        <>
          {hasSheen && (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: 999,
                  backgroundColor: dark ? '#FFFFFF' : '#000000',
                },
                sheenStyle,
              ]}
            />
          )}
          {children}
        </>
      )}
    </AnimatedPressable>
  );
}

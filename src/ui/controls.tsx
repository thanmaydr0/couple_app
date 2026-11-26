import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../theme';
import { useMotion } from '../motion/useMotion';
import { PressableScale } from '../motion/PressableScale';
import { Text } from './Text';

export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { colors, surfaces, spacing, radius } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 40,
        borderRadius: radius.pill,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? colors.primary : surfaces.rimStrong,
        backgroundColor: selected ? colors.primary : colors.surface,
        paddingHorizontal: spacing.md,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text variant="label" color={selected ? 'primaryContrast' : 'textPrimary'}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const { colors, surfaces, spacing, radius, dark } = useTheme();
  const motion = useMotion();
  const [width, setWidth] = useState(0);
  const count = Math.max(1, options.length);
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const cell = width > 0 ? width / count : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    if (width > 0) {
      x.value = motion.level === 'full' ? withSpring(index * cell, motion.spring('snappy')) : index * cell;
    }
  }, [index, cell, width, motion, x]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: cell,
    opacity: width > 0 ? 1 : 0,
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceAlt,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: surfaces.rim,
        padding: 4,
      }}
    >
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', position: 'relative' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: dark ? 0.3 : 0.16,
              shadowRadius: 6,
              elevation: 2,
            },
            indicatorStyle,
          ]}
        />
        {options.map(option => {
          const active = option.value === value;
          return (
            <PressableScale
              key={option.value}
              sheen={false}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: active }}
              onPress={() => onChange(option.value)}
              style={{
                flex: 1,
                minHeight: 40,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="label" numberOfLines={1} color={active ? 'primaryContrast' : 'textPrimary'}>
                {option.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

export function Switch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const { colors, surfaces, geometry, spacing, radius } = useTheme();
  const motion = useMotion();
  const position = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    position.value = motion.level === 'full' ? withSpring(value ? 1 : 0, motion.spring('snappy')) : value ? 1 : 0;
  }, [value, motion, position]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * (geometry.switchWidth - geometry.switchThumb - spacing.xs * 2) }],
  }));

  return (
    <PressableScale
      sheen={false}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: geometry.switchWidth,
          height: geometry.switchHeight,
          padding: spacing.xs,
          borderRadius: radius.pill,
          backgroundColor: value ? colors.primary : colors.surfaceAlt,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: value ? colors.primary : surfaces.rimStrong,
        }}
      >
        <Animated.View
          style={[
            {
              width: geometry.switchThumb,
              height: geometry.switchThumb,
              borderRadius: radius.pill,
              backgroundColor: value ? colors.primaryContrast : colors.textPrimary,
            },
            animated,
          ]}
        />
      </View>
    </PressableScale>
  );
}

export function Slider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 1,
  step = 0,
  disabled = false,
  accessibilityLabel,
}: {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const { colors, surfaces, geometry, radius } = useTheme();
  const motion = useMotion();
  const [width, setWidth] = useState<number>(geometry.touch);
  const range = Math.max(Number.EPSILON, maximumValue - minimumValue);
  const progress = useSharedValue(Math.max(0, Math.min(1, (value - minimumValue) / range)));
  const start = useSharedValue(0);
  const thumbScale = useSharedValue(1);

  useEffect(() => {
    progress.value = Math.max(0, Math.min(1, (value - minimumValue) / range));
  }, [value, minimumValue, range, progress]);

  const apply = (fraction: number) => {
    const raw = minimumValue + fraction * range;
    onValueChange(
      Math.max(
        minimumValue,
        Math.min(maximumValue, step > 0 ? minimumValue + Math.round((raw - minimumValue) / step) * step : raw)
      )
    );
  };

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      start.value = progress.value;
      if (motion.level === 'full') thumbScale.value = withSpring(1.18, motion.spring('snappy'));
    })
    .onUpdate(event => {
      progress.value = Math.max(0, Math.min(1, start.value + event.translationX / Math.max(1, width - geometry.thumb)));
      scheduleOnRN(apply, progress.value);
    })
    .onFinalize(() => {
      thumbScale.value = motion.level === 'full' ? withSpring(1, motion.spring('snappy')) : 1;
    });

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (width - geometry.thumb) }, { scale: thumbScale.value }],
  }));

  const fill = useAnimatedStyle(() => ({
    width: Math.max(geometry.thumb / 2, progress.value * (width - geometry.thumb) + geometry.thumb / 2),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        accessibilityValue={{ min: minimumValue, max: maximumValue, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => {
          if (!disabled) apply(progress.value + (e.nativeEvent.actionName === 'increment' ? 1 : -1) * (step > 0 ? step / range : 0.1));
        }}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        style={{ minHeight: geometry.touch, justifyContent: 'center', opacity: disabled ? geometry.disabledOpacity : 1 }}
      >
        <View style={{ height: geometry.track + 1, borderRadius: radius.pill, backgroundColor: surfaces.rimStrong }}>
          <Animated.View style={[{ height: geometry.track + 1, borderRadius: radius.pill, backgroundColor: colors.primary }, fill]} />
        </View>
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: geometry.thumb,
              height: geometry.thumb,
              borderRadius: radius.pill,
              borderColor: colors.primary,
              borderWidth: 2,
              backgroundColor: colors.bgElevated,
            },
            thumb,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

export function Badge({ children, label }: { children: ReactNode; label?: string }) {
  const { colors, radius, spacing } = useTheme();
  const motion = useMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (motion.level === 'full') {
      scale.value = 0.78;
      scale.value = withSpring(1, motion.spring('bouncy'));
    } else {
      scale.value = 1;
    }
  }, [children, motion, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      accessible
      accessibilityLabel={label}
      style={[
        {
          alignSelf: 'flex-start',
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: radius.pill,
          backgroundColor: colors.primary,
        },
        animated,
      ]}
    >
      <Text variant="caption" style={{ fontSize: 10.5, lineHeight: 14, fontWeight: '700' }} color="primaryContrast">
        {children}
      </Text>
    </Animated.View>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useMotion } from './useMotion';
import { PressableScale } from './PressableScale';
import { Text } from '../ui/Text';
import { Badge } from '../ui/controls';

export function useStackTransition(presentation: 'screen' | 'modal' = 'screen') {
  const motion = useMotion();
  const animation: 'none' | 'fade' | 'slide_from_bottom' | 'slide_from_right' =
    motion.level === 'off'
      ? 'none'
      : motion.level === 'reduced'
      ? 'fade'
      : presentation === 'modal'
      ? 'slide_from_bottom'
      : 'slide_from_right';
  return { animation, animationDuration: motion.duration('base') };
}

export type TabItem = {
  key: string;
  label: string;
  icon: (active: boolean) => ReactNode;
  badge?: number;
  accessibilityLabel?: string;
};

function Tab({
  item,
  active,
  onPress,
  onLongPress,
}: {
  item: TabItem;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors, spacing } = useTheme();
  const motion = useMotion();
  const bounce = useSharedValue(1);

  useEffect(() => {
    if (active && motion.level === 'full') {
      bounce.value = 0.86;
      bounce.value = withSpring(1, motion.spring('bouncy'));
    } else {
      bounce.value = 1;
    }
  }, [active, motion, bounce]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: bounce.value }, { translateY: active ? -1 : 0 }],
  }));

  return (
    <PressableScale
      sheen={false}
      accessibilityRole="tab"
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        flex: 1,
        minWidth: 48,
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        gap: 2,
      }}
    >
      <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={animated}>{item.icon(active)}</Animated.View>
        {!!item.badge && (
          <View style={{ position: 'absolute', right: -12, top: -6 }}>
            <Badge label={`${item.badge} unread`}>{item.badge > 99 ? '99+' : item.badge}</Badge>
          </View>
        )}
      </View>
      <Text
        variant="caption"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          fontSize: 10.5,
          lineHeight: 13,
          fontWeight: active ? '700' : '500',
          color: active ? colors.primary : colors.textSecondary,
          letterSpacing: 0.1,
          paddingHorizontal: spacing.xs / 2,
        }}
      >
        {item.label}
      </Text>
    </PressableScale>
  );
}

/** Floating glass pill tab dock with auto-hide on keyboard open and spring-sliding capsule indicator. */
export function AnimatedBottomTabBar({
  tabs,
  activeKey,
  onTabPress,
  onTabLongPress,
  hideOnKeyboard = true,
}: {
  tabs: readonly TabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
  onTabLongPress?: (key: string) => void;
  hideOnKeyboard?: boolean;
}) {
  const { colors, surfaces, spacing, radius, dark } = useTheme();
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const x = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (!hideOnKeyboard) return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [hideOnKeyboard]);

  const count = Math.max(1, tabs.length);
  const cell = width > 0 ? width / count : 0;
  const index = Math.max(
    0,
    tabs.findIndex(t => t.key === activeKey)
  );

  useEffect(() => {
    if (width > 0) {
      fade.value = withTiming(1, { duration: motion.duration('fast') });
      if (motion.level === 'full') x.value = withSpring(index * cell, motion.spring('snappy'));
      else x.value = index * cell;
    }
  }, [index, cell, width, motion, x, fade]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    opacity: width > 0 ? fade.value : 0,
    width: cell,
  }));

  if (hideOnKeyboard && keyboardOpen) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: 'transparent',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
      }}
    >
      <View
        style={{
          padding: 4,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: surfaces.rimStrong,
          backgroundColor: surfaces.glassBg,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: dark ? 0.45 : 0.1,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row' }}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                padding: 2,
              },
              indicatorStyle,
            ]}
          >
            <View
              style={{
                flex: 1,
                borderRadius: radius.pill,
                backgroundColor: surfaces.softPrimary,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: surfaces.rimStrong,
              }}
            />
          </Animated.View>
          {tabs.map(item => (
            <Tab
              key={item.key}
              item={item}
              active={activeKey === item.key}
              onPress={() => onTabPress(item.key)}
              onLongPress={() => onTabLongPress?.(item.key)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

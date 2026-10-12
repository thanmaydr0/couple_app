import { type PropsWithChildren } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useTheme, useThemeStyle } from '../theme';
import { DriftingGradient } from '../motion/effects';
const AnimatedSafeArea = Animated.createAnimatedComponent(SafeAreaView);
export type ScreenProps = PropsWithChildren<{ centered?: boolean; bottomInset?: boolean; gradient?: boolean; style?: StyleProp<ViewStyle> }>;
export function Screen({ children, centered = false, bottomInset = false, gradient = false, style }: ScreenProps) {
  const { spacing } = useTheme(); const animated = useThemeStyle({ backgroundColor: 'bg' }, StyleSheet.flatten(style));
  return <AnimatedSafeArea edges={bottomInset ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']} style={[{ flex: 1, padding: spacing.lg }, animated, centered && { alignItems: 'center', justifyContent: 'center' }, style]}>{gradient && <DriftingGradient />}{children}</AnimatedSafeArea>;
}

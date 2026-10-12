import { StyleSheet, type ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme, useThemeStyle } from '../theme';
export function Card({ style, ...props }: ViewProps) {
  const { radius, spacing, geometry } = useTheme(); const animated = useThemeStyle({ backgroundColor: 'surface', borderColor: 'border' }, StyleSheet.flatten(style));
  return <Animated.View {...props} style={[{ borderRadius: radius.lg, borderWidth: geometry.hairline, padding: spacing.md }, animated, style]} />;
}

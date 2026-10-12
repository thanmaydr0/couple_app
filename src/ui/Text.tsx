import { StyleSheet, type TextProps as NativeTextProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme, useThemeStyle, type TypeVariant, type ColorToken } from '../theme';
export type TextProps = NativeTextProps & { variant?: TypeVariant; color?: ColorToken };
export function Text({ style, variant = 'body/M', color = 'textPrimary', ...props }: TextProps) {
  const { typography } = useTheme(); const animated = useThemeStyle({ color }, StyleSheet.flatten(style));
  return <Animated.Text {...props} style={[typography[variant], animated, style]} />;
}

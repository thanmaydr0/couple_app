import { StyleSheet, type ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme, useThemeStyle } from '../theme';

export type CardProps = ViewProps & { variant?: 'default' | 'elevated' | 'flat' };

export function Card({ style, variant = 'default', ...props }: CardProps) {
  const { radius, spacing, geometry, colors, dark } = useTheme();
  const animated = useThemeStyle({ backgroundColor: variant === 'flat' ? 'surfaceAlt' : 'surface', borderColor: 'border' }, StyleSheet.flatten(style));
  const isElevated = variant === 'elevated' || variant === 'default';
  return (
    <Animated.View
      {...props}
      style={[
        {
          borderRadius: radius.lg,
          borderWidth: geometry.hairline,
          padding: spacing.md,
        },
        isElevated && {
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: dark ? 0.32 : 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
        animated,
        style,
      ]}
    />
  );
}

import { StyleSheet, type ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme, useThemeStyle } from '../theme';

export type CardProps = ViewProps & { variant?: 'default' | 'elevated' | 'flat' };

export function Card({ style, variant = 'default', ...props }: CardProps) {
  const { radius, spacing, colors, surfaces, dark } = useTheme();
  const animated = useThemeStyle(
    { backgroundColor: variant === 'flat' ? 'surfaceAlt' : 'surface' },
    StyleSheet.flatten(style)
  );
  const isElevated = variant === 'elevated' || variant === 'default';

  return (
    <Animated.View
      {...props}
      style={[
        {
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isElevated ? surfaces.rimStrong : surfaces.rim,
          padding: spacing.md,
        },
        isElevated && {
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: dark ? 0.36 : 0.06,
          shadowRadius: 12,
          elevation: 2,
        },
        animated,
        style,
      ]}
    />
  );
}

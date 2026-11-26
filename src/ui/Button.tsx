import { ActivityIndicator, StyleSheet, View, type PressableProps } from 'react-native';
import { Text } from './Text';
import { useTheme, useThemeStyle, type ColorToken } from '../theme';
import { PressableScale } from '../motion/PressableScale';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};

export function Button({
  title,
  style,
  disabled,
  loading = false,
  variant = 'primary',
  ...props
}: ButtonProps) {
  const { colors, surfaces, spacing, radius, geometry, dark } = useTheme();
  const ink: ColorToken = variant === 'danger' || variant === 'primary' ? 'primaryContrast' : 'textPrimary';
  const animated = useThemeStyle(
    variant === 'ghost'
      ? {}
      : {
          backgroundColor: variant === 'secondary' ? 'surfaceAlt' : variant === 'danger' ? 'danger' : 'primary',
        }
  );

  return (
    <PressableScale
      {...props}
      sheen={variant !== 'ghost'}
      themeStyle={style ? undefined : animated}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ ...props.accessibilityState, busy: loading, disabled: !!disabled || loading }}
      style={state => [
        {
          minHeight: geometry.touch,
          paddingHorizontal: spacing.s20,
          paddingVertical: spacing.s12,
          borderRadius: radius.pill,
          overflow: 'hidden',
          backgroundColor:
            variant === 'ghost'
              ? 'transparent'
              : variant === 'secondary'
              ? colors.surfaceAlt
              : variant === 'danger'
              ? colors.danger
              : colors.primary,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderColor: surfaces.rimStrong,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? geometry.disabledOpacity : 1,
          shadowColor: variant === 'primary' ? colors.primary : colors.shadowColor,
          shadowOffset: { width: 0, height: variant === 'primary' ? 4 : 0 },
          shadowOpacity: variant === 'primary' && !disabled ? (dark ? 0.35 : 0.18) : 0,
          shadowRadius: 10,
          elevation: variant === 'primary' && !disabled ? 3 : 0,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {loading && <ActivityIndicator color={colors[ink]} />}
        <Text variant="label" color={ink} style={{ flexShrink: 1, textAlign: 'center' }}>
          {title}
        </Text>
      </View>
    </PressableScale>
  );
}

import { ActivityIndicator, View, type PressableProps } from 'react-native';
import { Text } from './Text';
import { useTheme, useThemeStyle, type ColorToken } from '../theme';
import { PressableScale } from '../motion/PressableScale';
export type ButtonProps = Omit<PressableProps, 'children'> & { title: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean };
export function Button({ title, style, disabled, loading = false, variant = 'primary', ...props }: ButtonProps) {
  const { colors, spacing, radius, geometry } = useTheme();
  const ink: ColorToken = variant === 'danger' || variant === 'primary' ? 'primaryContrast' : 'textPrimary';
  const animated = useThemeStyle(variant === 'ghost' ? {} : { backgroundColor: variant === 'secondary' ? 'surfaceAlt' : variant === 'danger' ? 'danger' : 'primary', borderColor: 'border' });
  return <PressableScale {...props} themeStyle={style ? undefined : animated} disabled={disabled || loading} accessibilityRole="button" accessibilityState={{ ...props.accessibilityState, busy: loading, disabled: !!disabled || loading }} style={state => [{ minHeight: geometry.touch, paddingHorizontal: spacing.s20, paddingVertical: spacing.s12, borderRadius: radius.pill, backgroundColor: variant === 'ghost' ? 'transparent' : variant === 'secondary' ? colors.surfaceAlt : variant === 'danger' ? colors.danger : colors.primary, borderWidth: variant === 'secondary' ? geometry.hairline : 0, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: disabled ? geometry.disabledOpacity : state.pressed ? 0.75 : 1 }, typeof style === 'function' ? style(state) : style]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>{loading && <ActivityIndicator color={colors[ink]} />}<Text variant="label" color={ink} style={{ flexShrink: 1, textAlign: 'center' }}>{title}</Text></View>
  </PressableScale>;
}

import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../theme';
export type TextFieldProps = TextInputProps & { label: string; error?: string; hint?: string };
export function TextField({ label, error, hint, style, onFocus, onBlur, ...props }: TextFieldProps) {
  const { colors, spacing, radius, geometry, typography } = useTheme(); const [focused, setFocused] = useState(false);
  return <View style={{ gap: spacing.sm }}><Text variant="label">{label}</Text><TextInput accessibilityLabel={label} accessibilityHint={error ?? hint} placeholderTextColor={colors.textMuted} selectionColor={colors.primary} {...props} onFocus={e => { setFocused(true); onFocus?.(e); }} onBlur={e => { setFocused(false); onBlur?.(e); }} style={[typography['body/M'], { color: colors.textPrimary, backgroundColor: colors.surfaceAlt, borderColor: error ? colors.danger : focused ? colors.primary : colors.border, borderWidth: focused ? geometry.stroke : geometry.hairline, borderRadius: radius.md, minHeight: geometry.field, paddingHorizontal: spacing.md, paddingVertical: spacing.s12, opacity: props.editable === false ? geometry.disabledOpacity : 1 }, style]} />{(error || hint) && <Text variant="caption" color={error ? 'danger' : 'textSecondary'} accessibilityLiveRegion={error ? 'polite' : 'none'}>{error ?? hint}</Text>}</View>;
}

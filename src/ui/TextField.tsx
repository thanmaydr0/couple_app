import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../theme';

export type TextFieldProps = TextInputProps & { label: string; error?: string; hint?: string };

export function TextField({ label, error, hint, style, onFocus, onBlur, ...props }: TextFieldProps) {
  const { colors, surfaces, spacing, radius, geometry, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label" color="textSecondary" style={{ paddingLeft: 2 }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        {...props}
        onFocus={e => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={e => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          typography['body/M'],
          {
            color: colors.textPrimary,
            backgroundColor: focused ? colors.bgElevated : colors.surfaceAlt,
            borderColor: error ? colors.danger : focused ? colors.primary : surfaces.rim,
            borderWidth: focused || error ? 1.5 : StyleSheet.hairlineWidth,
            borderRadius: radius.md,
            minHeight: geometry.field,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.s12,
            opacity: props.editable === false ? geometry.disabledOpacity : 1,
          },
          style,
        ]}
      />
      {(error || hint) && (
        <Text
          variant="caption"
          color={error ? 'danger' : 'textSecondary'}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={{ paddingLeft: 2 }}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

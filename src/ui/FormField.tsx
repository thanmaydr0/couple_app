import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { theme } from './theme';
export function FormField({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 8 }}><Text>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={theme.colors.muted} selectionColor={theme.colors.primary} {...props} style={[{ color: theme.colors.text, backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 12, minHeight: 52, paddingHorizontal: 16, fontSize: 16 }, props.style]} /></View>;
}

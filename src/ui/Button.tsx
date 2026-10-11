import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { Text } from './Text';
import { theme } from './theme';

export type ButtonProps = Omit<PressableProps, 'children'> & { title: string };
export function Button({ title, style, disabled, ...props }: ButtonProps) {
  return <Pressable {...props} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={(state) => [styles.button, { opacity: disabled ? 0.4 : state.pressed ? 0.75 : 1 }, typeof style === 'function' ? style(state) : style]}>
    <Text style={styles.label}>{title}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 12, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  label: { color: theme.colors.onPrimary, fontWeight: '600' },
});

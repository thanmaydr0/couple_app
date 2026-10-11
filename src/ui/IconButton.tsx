import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { theme } from './theme';

type IconButtonProps = Omit<PressableProps, 'children' | 'accessibilityLabel'> & {
  name: ComponentProps<typeof Ionicons>['name']; accessibilityLabel: string;
};
export function IconButton({ name, style, disabled, ...props }: IconButtonProps) {
  return <Pressable {...props} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={(state) => [{ minWidth: 48, minHeight: 48, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, opacity: disabled ? 0.4 : state.pressed ? 0.7 : 1 }, typeof style === 'function' ? style(state) : style]}>
    <Ionicons name={name} size={24} color={theme.colors.primary} />
  </Pressable>;
}

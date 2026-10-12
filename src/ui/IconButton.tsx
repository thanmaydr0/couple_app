import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';
import { type PressableProps } from 'react-native';
import { useTheme } from '../theme';
import { PressableScale } from '../motion/PressableScale';
export type IconButtonProps = Omit<PressableProps, 'children' | 'accessibilityLabel'> & { name: ComponentProps<typeof Ionicons>['name']; accessibilityLabel: string };
export function IconButton({ name, style, disabled, ...props }: IconButtonProps) {
  const { colors, radius, geometry } = useTheme();
  return <PressableScale {...props} disabled={disabled} accessibilityRole="button" style={state => [{ minWidth: geometry.touch, minHeight: geometry.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, opacity: disabled ? geometry.disabledOpacity : state.pressed ? 0.7 : 1 }, typeof style === 'function' ? style(state) : style]}><Ionicons name={name} size={geometry.icon} color={colors.primary} /></PressableScale>;
}

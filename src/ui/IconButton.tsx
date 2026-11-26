import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';
import { StyleSheet, type PressableProps } from 'react-native';
import { useTheme } from '../theme';
import { PressableScale } from '../motion/PressableScale';

export type IconButtonProps = Omit<PressableProps, 'children' | 'accessibilityLabel'> & {
  name: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel: string;
};

export function IconButton({ name, style, disabled, ...props }: IconButtonProps) {
  const { colors, surfaces, radius, geometry } = useTheme();
  return (
    <PressableScale
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      style={state => [
        {
          minWidth: geometry.touch,
          minHeight: geometry.touch,
          borderRadius: radius.pill,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: surfaces.rimStrong,
          opacity: disabled ? geometry.disabledOpacity : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Ionicons name={name} size={geometry.icon - 2} color={colors.primary} />
    </PressableScale>
  );
}

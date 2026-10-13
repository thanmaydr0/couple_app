import { View } from 'react-native';
import type { PropsWithChildren } from 'react';
import { Text } from '@/ui';
import { useTheme } from '@/theme';
import { PressableScale } from '@/motion';
export function YtButton({ title, onPress, disabled }: { title: string; onPress(): void; disabled?: boolean }) {
  const { colors, spacing, radius, geometry } = useTheme();
  return <PressableScale accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: geometry.touch, minWidth: geometry.touch, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, opacity: disabled ? geometry.disabledOpacity : 1 }}><Text variant="label">{title}</Text></PressableScale>;
}
export function YtCard({ children }: PropsWithChildren) {
  const { colors, spacing, radius } = useTheme();
  return <View style={{ padding: spacing.md, gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }}>{children}</View>;
}

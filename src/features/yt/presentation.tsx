import type { PropsWithChildren } from 'react';
import { Card, Text } from '@/ui';
import { useTheme } from '@/theme';
import { PressableScale } from '@/motion';

export function YtButton({ title, onPress, disabled }: { title: string; onPress(): void; disabled?: boolean }) {
  const { surfaces, spacing, radius, geometry } = useTheme();
  return <PressableScale accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: geometry.touch, minWidth: geometry.touch, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: surfaces.softPrimary, borderWidth: geometry.hairline, borderColor: surfaces.rimStrong, opacity: disabled ? geometry.disabledOpacity : 1 }}><Text variant="label">{title}</Text></PressableScale>;
}
export function YtCard({ children }: PropsWithChildren) {
  const { spacing } = useTheme();
  return <Card variant="elevated" style={{ gap: spacing.sm }}>{children}</Card>;
}

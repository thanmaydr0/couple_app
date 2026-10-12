import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme';
import { PressableScale } from '../motion/PressableScale';
import { Text } from './Text';
import { Button } from './Button';
import { IconButton } from './IconButton';
export function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  const { spacing } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.lg }}>{onBack && <IconButton name="arrow-back" accessibilityLabel="Go back" onPress={onBack} />}<View style={{ flex: 1, gap: spacing.xs }}><Text variant="title/L" accessibilityRole="header">{title}</Text>{subtitle && <Text variant="body/S" color="textSecondary">{subtitle}</Text>}</View>{right}</View>;
}
export function ListItem({ title, subtitle, leading, trailing, onPress, disabled, style }: { title: string; subtitle?: string; leading?: ReactNode; trailing?: ReactNode; onPress?: () => void; disabled?: boolean; style?: ViewProps['style'] }) {
  const { spacing, colors, geometry } = useTheme();
  const content = <>{leading}<View style={{ flex: 1, gap: spacing.xs }}><Text>{title}</Text>{subtitle && <Text variant="body/S" color="textSecondary">{subtitle}</Text>}</View>{trailing}</>;
  const layout = { minHeight: geometry.touch, paddingVertical: spacing.s12, flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md, borderBottomColor: colors.border, borderBottomWidth: geometry.hairline };
  return onPress ? <PressableScale accessibilityRole="button" disabled={disabled} onPress={onPress} style={[layout, style]}>{content}</PressableScale> : <View style={[layout, style]}>{content}</View>;
}
export function EmptyState({ title = 'A little space for what comes next', description, actionLabel, onAction }: { title?: string; description?: string; actionLabel?: string; onAction?: () => void }) {
  const { spacing, colors, geometry } = useTheme();
  return <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}><Ionicons name="albums-outline" size={geometry.touch} color={colors.primary} /><Text variant="title/M" accessibilityRole="header" style={{ textAlign: 'center' }}>{title}</Text>{description && <Text color="textSecondary" style={{ textAlign: 'center' }}>{description}</Text>}{actionLabel && onAction && <Button title={actionLabel} onPress={onAction} />}</View>;
}
export function ErrorState({ title = 'Something went wrong', description = 'Try again when you’re ready.', onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  const { spacing, colors, geometry } = useTheme();
  return <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}><Ionicons name="alert-circle-outline" size={geometry.touch} color={colors.danger} /><Text variant="title/M" accessibilityRole="header">{title}</Text><Text color="textSecondary" style={{ textAlign: 'center' }}>{description}</Text>{onRetry && <Button title="Try again" onPress={onRetry} />}</View>;
}

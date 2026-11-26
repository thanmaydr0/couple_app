import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme';
import { PressableScale } from '../motion/PressableScale';
import { Text } from './Text';
import { Button } from './Button';
import { IconButton } from './IconButton';

export function Header({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, paddingBottom: spacing.md }}>
      {onBack && <IconButton name="chevron-back" accessibilityLabel="Go back" onPress={onBack} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title/L" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="body/S" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  disabled,
  style,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewProps['style'];
}) {
  const { spacing, colors, surfaces, geometry } = useTheme();
  const defaultTrailing =
    onPress && trailing === undefined ? (
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    ) : (
      trailing
    );

  const content = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title/S">{title}</Text>
        {subtitle && (
          <Text variant="body/S" color="textSecondary">
            {subtitle}
          </Text>
        )}
      </View>
      {defaultTrailing}
    </>
  );

  const layout = {
    minHeight: geometry.touch + 4,
    paddingVertical: spacing.s12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    borderBottomColor: surfaces.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  };

  return onPress ? (
    <PressableScale accessibilityRole="button" disabled={disabled} onPress={onPress} style={[layout, style]}>
      {content}
    </PressableScale>
  ) : (
    <View style={[layout, style]}>{content}</View>
  );
}

export function EmptyState({
  title = 'A little space for what comes next',
  description,
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { spacing, colors, surfaces, radius } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.pill,
          backgroundColor: surfaces.softPrimary,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: surfaces.rimStrong,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="sparkles-outline" size={28} color={colors.primary} />
      </View>
      <Text variant="title/M" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {description && (
        <Text variant="body/S" color="textSecondary" style={{ textAlign: 'center', maxWidth: 280 }}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} />}
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Try again when you’re ready.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  const { spacing, colors, radius } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
      </View>
      <Text variant="title/M" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="body/S" color="textSecondary" style={{ textAlign: 'center', maxWidth: 280 }}>
        {description}
      </Text>
      {onRetry && <Button title="Try again" onPress={onRetry} />}
    </View>
  );
}

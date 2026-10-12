import { getLegacyColors } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
/** @deprecated Use useTheme(). Module-level StyleSheet values remain snapshots until restyled. */
export const theme = {
  colors: {
    get background() { return getLegacyColors().bg; }, get surface() { return getLegacyColors().surface; },
    get surfaceRaised() { return getLegacyColors().surfaceAlt; }, get primary() { return getLegacyColors().primary; },
    get onPrimary() { return getLegacyColors().primaryContrast; }, get text() { return getLegacyColors().textPrimary; },
    get muted() { return getLegacyColors().textMuted; }, get border() { return getLegacyColors().border; },
    get success() { return getLegacyColors().success; }, get danger() { return getLegacyColors().danger; },
  },
  spacing: { xs: spacing.xs, sm: spacing.sm, md: spacing.md, lg: spacing.lg, xl: spacing.xl },
  radius: { sm: radius.sm, md: radius.md, lg: spacing.lg, pill: radius.pill },
};

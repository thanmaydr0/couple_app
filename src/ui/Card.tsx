import { View, type ViewProps } from 'react-native';
import { theme } from './theme';

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md }, style]} />;
}

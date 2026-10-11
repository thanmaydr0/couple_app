import { type PropsWithChildren } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from './theme';

export function Screen({ children, centered = false, bottomInset = false, style }: PropsWithChildren<{ centered?: boolean; bottomInset?: boolean; style?: StyleProp<ViewStyle> }>) {
  return <SafeAreaView edges={bottomInset ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']} style={[styles.screen, centered && styles.centered, style]}>{children}</SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.lg },
  centered: { alignItems: 'center', justifyContent: 'center' },
});

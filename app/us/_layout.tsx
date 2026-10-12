import { Stack } from 'expo-router';
import { useTheme } from '@/theme';
import { useStackTransition } from '@/motion';

export default function UsLayout() {
  const { colors } = useTheme(); const transition = useStackTransition();
  return <Stack screenOptions={{ ...transition, headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}

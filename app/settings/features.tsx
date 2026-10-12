import { ScrollView, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Screen, Header, Text, PressableScale, EmptyState, ErrorState } from '@/ui';
import { Skeleton } from '@/motion';
import { useTheme } from '@/theme';
import { useSession } from '@/lib/hooks';
import { featureRegistry } from '@/features/registry';
import { useFeaturePreferences } from '@/features/feature-preferences';
export default function FeaturesSettings() {
  const { spacing, geometry, colors, radius } = useTheme(); const { data: session } = useSession();
  const { hidden, toggle, ready, error } = useFeaturePreferences(); const userId = session?.user.id ?? '';
  const features = featureRegistry.filter(feature => feature.enabled);
  return <Screen><Stack.Screen options={{ headerShown: false }} /><Header title="Features" subtitle="Choose what appears on this phone" onBack={() => router.back()} /><ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>{!ready ? <Skeleton /> : features.length ? features.map(feature => { const shown = !(hidden[userId] ?? []).includes(feature.id); return <PressableScale key={feature.id} accessibilityRole="switch" accessibilityLabel={feature.title} accessibilityState={{ checked: shown }} disabled={!userId} onPress={() => toggle(userId, feature.id)} style={{ minHeight: geometry.touch, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}><View style={{ flex: 1 }}><Text>{feature.title}</Text><Text variant="body/S" color="textSecondary">{feature.subtitle}</Text></View><Text color={shown ? 'primary' : 'textSecondary'}>{shown ? 'On' : 'Off'}</Text></PressableScale>; }) : <EmptyState title="New features are coming" description="Available features will appear here. Your choices affect this phone only." />}{error && <ErrorState description={error} onRetry={() => { void useFeaturePreferences.persist.rehydrate(); }} />}</ScrollView></Screen>;
}

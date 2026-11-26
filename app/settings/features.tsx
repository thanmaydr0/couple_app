import { ScrollView, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Screen, Header, Text, Card, Switch, EmptyState, ErrorState } from '@/ui';
import { Skeleton, StaggerList } from '@/motion';
import { useTheme } from '@/theme';
import { useSession } from '@/lib/hooks';
import { featureRegistry } from '@/features/registry';
import { useFeaturePreferences } from '@/features/feature-preferences';
export default function FeaturesSettings() {
  const { spacing } = useTheme(); const { data: session } = useSession();
  const { hidden, toggle, ready, error } = useFeaturePreferences(); const userId = session?.user.id ?? '';
  const features = featureRegistry.filter(feature => feature.enabled);
  return <Screen atmosphere gradient bottomInset><Stack.Screen options={{ headerShown: false }} /><Header title="Home shortcuts" subtitle="Choose what appears on this phone" onBack={() => router.back()} /><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>{!ready ? <Skeleton /> : features.length ? <StaggerList style={{ gap: spacing.sm }}>{features.map(feature => { const shown = !(hidden[userId] ?? []).includes(feature.id); return <Card variant="elevated" key={feature.id} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}><View style={{ flex: 1, gap: 2 }}><Text variant="title/S">{feature.title}</Text><Text variant="body/S" color="textSecondary">{feature.subtitle}</Text></View><Switch accessibilityLabel={feature.title} value={shown} disabled={!userId} onValueChange={() => toggle(userId, feature.id)} /></Card>; })}</StaggerList> : <EmptyState title="New features are coming" description="Available features will appear here. Your choices affect this phone only." />}{error && <ErrorState description={error} onRetry={() => { void useFeaturePreferences.persist.rehydrate(); }} />}</ScrollView></Screen>;
}

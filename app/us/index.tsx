import { ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { Screen, Header, EmptyState, ErrorState } from '@/ui';
import { StaggerList, Skeleton } from '@/motion';
import { useTheme } from '@/theme';
import { useEnabledFeatures, useFeaturePreferences } from '@/features/feature-preferences';
import { FeatureLink } from '@/features/shared/FeatureSlots';
export default function UsHub() {
  const features = useEnabledFeatures(); const { spacing } = useTheme();
  const ready = useFeaturePreferences(state => state.ready); const error = useFeaturePreferences(state => state.error);
  return <Screen><Stack.Screen options={{ headerShown: false }} /><Header title="Us" subtitle="Little ways to be together" onBack={() => router.back()} /><ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>{!ready ? <Skeleton /> : <><StaggerList style={{ gap: spacing.md }}>{features.map(feature => <FeatureLink key={feature.id} feature={feature} />)}</StaggerList>{!features.length && <EmptyState title="More of us is on its way" description="New features will appear here when they are ready." />}{error && <ErrorState description={error} onRetry={() => { void useFeaturePreferences.persist.rehydrate(); }} />}</>}</ScrollView></Screen>;
}

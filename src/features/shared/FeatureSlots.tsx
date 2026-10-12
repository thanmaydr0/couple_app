import { ScrollView, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Text, PressableScale, Button } from '@/ui';
import { useTheme } from '@/theme';
import { StaggerList } from '@/motion';
import { useEnabledFeatures } from '../feature-preferences';
import type { FeatureEntry } from '../registry-types';
export function FeatureLink({ feature }: { feature: FeatureEntry }) {
  const { colors, spacing, geometry } = useTheme();
  return <PressableScale accessibilityRole="button" accessibilityLabel={`Open ${feature.title}`} onPress={() => router.push(feature.route)}><Card style={{ gap: spacing.sm, minHeight: geometry.touch * 2 }}><Ionicons name={feature.icon} size={geometry.icon} color={colors.primary} /><Text variant="title/S">{feature.title}</Text><Text variant="body/S" color="textSecondary">{feature.subtitle}</Text></Card></PressableScale>;
}
export function MoreOfUs() {
  const features = useEnabledFeatures(); const { spacing, geometry } = useTheme();
  const { width } = useWindowDimensions();
  const firstScreenful = Math.max(1, Math.ceil((width - spacing.lg * 2) / (geometry.touch * 5 + spacing.md)));
  if (!features.length) return null;
  return <View style={{ gap: spacing.md }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text variant="title/M">More of us</Text><Button title="See all" variant="ghost" onPress={() => router.push('/us')} /></View><ScrollView horizontal showsHorizontalScrollIndicator={false}><StaggerList firstScreenful={firstScreenful} style={{ flexDirection: 'row', gap: spacing.md }}>{features.map(feature => <View key={feature.id} style={{ width: geometry.touch * 5 }}><FeatureLink feature={feature} /></View>)}</StaggerList></ScrollView></View>;
}
export function HomeCards() { const features = useEnabledFeatures(); return <>{features.map(({ id, HomeCard }) => HomeCard ? <HomeCard key={id} /> : null)}</>; }
export function SettingsSections() { const features = useEnabledFeatures(); return <>{features.map(({ id, SettingsSection }) => SettingsSection ? <SettingsSection key={id} /> : null)}</>; }
export function FeatureGames() { const features = useEnabledFeatures().filter(feature => feature.group === 'game'); const { spacing } = useTheme(); if (!features.length) return null; return <View style={{ gap: spacing.md }}>{features.map(feature => <FeatureLink key={feature.id} feature={feature} />)}</View>; }

import { ScrollView, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Text, PressableScale } from '@/ui';
import { useTheme } from '@/theme';
import { StaggerList } from '@/motion';
import { useEnabledFeatures } from '../feature-preferences';
import type { FeatureEntry } from '../registry-types';

export function FeatureLink({ feature }: { feature: FeatureEntry }) {
  const { colors, surfaces, spacing, geometry, radius } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Open ${feature.title}`}
      onPress={() => router.push(feature.route)}
    >
      <Card variant="elevated" style={{ gap: spacing.sm, minHeight: geometry.touch * 2.2, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: radius.md,
              backgroundColor: surfaces.softPrimary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={feature.icon} size={20} color={colors.primary} />
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
        <View style={{ gap: 2 }}>
          <Text variant="title/S" numberOfLines={1}>
            {feature.title}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={2}>
            {feature.subtitle}
          </Text>
        </View>
      </Card>
    </PressableScale>
  );
}

export function MoreOfUs() {
  const features = useEnabledFeatures();
  const { spacing, geometry } = useTheme();
  const { width } = useWindowDimensions();
  const firstScreenful = Math.max(1, Math.ceil((width - spacing.lg * 2) / (geometry.touch * 4.5 + spacing.md)));
  if (!features.length) return null;

  return (
    <View style={{ gap: spacing.s12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title/M">More of us</Text>
        <PressableScale
          sheen={false}
          accessibilityRole="button"
          onPress={() => router.push('/us')}
          style={{ minHeight: 34, paddingHorizontal: 8, justifyContent: 'center' }}
        >
          <Text variant="label" color="primary">
            See all
          </Text>
        </PressableScale>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <StaggerList firstScreenful={firstScreenful} style={{ flexDirection: 'row', gap: spacing.s12 }}>
          {features.map(feature => (
            <View key={feature.id} style={{ width: geometry.touch * 4.2 }}>
              <FeatureLink feature={feature} />
            </View>
          ))}
        </StaggerList>
      </ScrollView>
    </View>
  );
}

export function HomeCards() {
  const features = useEnabledFeatures();
  return <>{features.map(({ id, HomeCard }) => (HomeCard ? <HomeCard key={id} /> : null))}</>;
}

export function SettingsSections() {
  const features = useEnabledFeatures();
  return <>{features.map(({ id, SettingsSection }) => (SettingsSection ? <SettingsSection key={id} /> : null))}</>;
}

export function FeatureGames() {
  const features = useEnabledFeatures().filter(feature => feature.group === 'game');
  const { spacing } = useTheme();
  if (!features.length) return null;
  return (
    <View style={{ gap: spacing.md }}>
      {features.map(feature => (
        <FeatureLink key={feature.id} feature={feature} />
      ))}
    </View>
  );
}

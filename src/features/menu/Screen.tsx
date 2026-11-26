import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Header, Text, TextField, Card, PressableScale, EmptyState } from '@/ui';
import { useTheme } from '@/theme';
import { featureRegistry } from '@/features/registry';
import { buildCatalog, searchCatalog, sections } from './catalog';

const catalog = buildCatalog(featureRegistry);
export default function FeatureMenu() {
  const { spacing, geometry, colors, surfaces, radius } = useTheme();
  const [query, setQuery] = useState('');
  const items = searchCatalog(catalog, query);
  return <Screen atmosphere bottomInset gradient><Stack.Screen options={{ headerShown: false }} />
    <Header title="All features" subtitle="Everything for the two of you, in one place" onBack={() => router.back()} />
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
      <TextField label="Find a feature" placeholder="Touch, games, photos, plans…" value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" />
      <Text variant="caption" color="textSecondary">{items.length} features · Live features reconnect when you’re online.</Text>
      {sections.map(section => {
        const entries = items.filter(item => item.section === section);
        return entries.length ? <View key={section} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="title/M" accessibilityRole="header">{section}</Text>
            <Text variant="caption" color="textSecondary">{entries.length}</Text>
          </View>
          {entries.map(item => <PressableScale key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => router.push(item.route)}>
            <Card variant="elevated" style={{ minHeight: geometry.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: spacing.s40, height: spacing.s40, borderRadius: radius.md, backgroundColor: surfaces.softPrimary, borderWidth: geometry.hairline, borderColor: surfaces.rim, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}><Text variant="title/S">{item.title}</Text><Text variant="body/S" color="textSecondary">{item.subtitle}</Text></View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Card>
          </PressableScale>)}
        </View> : null;
      })}
      {!items.length && <EmptyState title="No matching features" description="Try another name, such as Touch, memories or games." />}
    </ScrollView>
  </Screen>;
}

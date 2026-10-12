import { ScrollView, View, useColorScheme } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useTheme, useThemeStore, useAppearanceStatus, themes, themeIds, accentSwatches, type ThemeId, type AnimationLevel } from '@/theme';
import { accessibleAccent } from '@/theme/contrast';
import { Button, Card, Header, PressableScale, Screen, SegmentedControl, Text } from '@/ui';
import { FadeInView, HeartbeatView, PulseRing, useMotion } from '@/motion';
import { FailureToast, OfflineNotice } from '@/features/presence/Presentation';

function ThemePreview({ id }: { id: ThemeId }) {
  const { colors, spacing, radius, geometry } = useTheme();
  const { themeId, accentOverride, setThemeId } = useThemeStore();
  const scheme = useColorScheme();
  const base = themes[id === 'Auto' ? scheme === 'dark' ? 'Midnight' : 'Rose' : id];
  const preview = accentOverride ? { ...base, ...accessibleAccent(base, themes[accentOverride]) } : base;
  const selected = themeId === id;
  return <PressableScale accessibilityRole="radio" accessibilityLabel={`${id} theme`} accessibilityState={{ checked: selected }} onPress={() => setThemeId(id)}
    style={{ flexGrow: 1, flexBasis: '45%', minWidth: geometry.touch * 2, padding: spacing.s12, gap: spacing.sm, borderRadius: radius.md, borderWidth: geometry.stroke, borderColor: selected ? colors.primary : colors.border, backgroundColor: preview.bg }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}><Text variant="label" style={{ color: preview.textPrimary, flex: 1 }}>{id}</Text>{selected && <Ionicons name="checkmark-circle" size={geometry.icon} color={preview.primary} />}</View>
    <Text variant="title/S" style={{ color: preview.textPrimary }}>A little closer.</Text>
    <View style={{ backgroundColor: preview.bubbleTheirs, padding: spacing.sm, borderRadius: radius.sm, alignSelf: 'flex-start' }}><Text variant="caption" style={{ color: preview.bubbleTheirsText }}>Always.</Text></View>
    <View style={{ backgroundColor: preview.primary, padding: spacing.sm, borderRadius: radius.sm, alignSelf: 'flex-end' }}><Text variant="caption" style={{ color: preview.primaryContrast }}>With you ♥</Text></View>
  </PressableScale>;
}

export default function AppearanceScreen() {
  const { colors, spacing, radius, geometry } = useTheme();
  const { themeId, accentOverride, animationLevel, setAccentOverride, setAnimationLevel } = useThemeStore();
  const persistenceError = useAppearanceStatus(state => state.persistenceError);
  const motion = useMotion();
  return <Screen bottomInset><Stack.Screen options={{ headerShown: false }} /><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
    <View><Text variant="caption" color="textSecondary">OUR SPACE, YOUR WAY</Text><Header title="Appearance" onBack={() => router.back()} subtitle="A little more you. Changes apply right away." /></View>
    <OfflineNotice message="You’re offline. Appearance changes still apply and save on this phone." /><FailureToast message={persistenceError ?? ''} />
    {!!persistenceError && <Text accessibilityRole="alert" color="danger">{persistenceError}</Text>}
    <View style={{ gap: spacing.sm }}><Text variant="title/M" accessibilityRole="header">Your theme</Text><Text variant="body/S" color="textSecondary">{themeId} selected. Auto follows your phone’s light or dark appearance.</Text></View>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 }}>{themeIds.map(id => <ThemePreview key={id} id={id} />)}</View>
    <Card style={{ gap: spacing.md }}><Text variant="title/M" accessibilityRole="header">Make it yours</Text><Text variant="body/S" color="textSecondary">Choose an accent. Its shade adjusts to keep text readable.</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{accentSwatches.map(swatch => <PressableScale key={swatch.id} accessibilityRole="radio" accessibilityLabel={`${swatch.id} accent`} accessibilityState={{ checked: accentOverride === swatch.id }} onPress={() => setAccentOverride(swatch.id)}
        style={{ width: geometry.touch, height: geometry.touch, borderRadius: radius.pill, borderWidth: geometry.stroke, borderColor: accentOverride === swatch.id ? colors.textPrimary : colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: swatch.color }}>
        {accentOverride === swatch.id && <Ionicons name="checkmark" size={geometry.icon} color={themes[swatch.id].primaryContrast} />}
      </PressableScale>)}</View>
      <Text variant="caption" color="textSecondary">{accentOverride ? `${accentOverride} accent selected` : 'Using the theme’s default accent'}</Text>
      <Button title="Reset to theme default" variant="ghost" onPress={() => setAccentOverride(null)} />
    </Card>
    <Card style={{ gap: spacing.md }}><Text variant="title/M" accessibilityRole="header">Animations</Text>
      <SegmentedControl<AnimationLevel> options={[{ value: 'full', label: 'Full' }, { value: 'reduced', label: 'Reduced' }, { value: 'off', label: 'Off' }]} value={animationLevel} onChange={setAnimationLevel} />
      <Text variant="body/S" color="textSecondary">{motion.systemReduced && animationLevel === 'full' ? 'Your phone’s Reduce Motion setting is active. Motion stays reduced.' : animationLevel === 'full' ? 'Gentle movement, a little life.' : animationLevel === 'reduced' ? 'Quiet fades with less movement.' : 'Everything settles instantly.'}</Text>
      <FadeInView key={motion.level} style={{ alignItems: 'center', padding: spacing.md, gap: spacing.sm }}><HeartbeatView><PulseRing size={spacing.s56}><Ionicons name="heart" size={geometry.icon} color={colors.primary} /></PulseRing></HeartbeatView><Text variant="caption" color="textSecondary">Live preview</Text></FadeInView>
    </Card>
    <Text variant="caption" color="textSecondary">Saved on this phone. Your partner’s appearance stays their own.</Text>
  </ScrollView></Screen>;
}

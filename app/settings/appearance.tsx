import { useEffect, useState } from 'react';
import { ScrollView, View, useColorScheme } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme, useThemeStore, useAppearanceStatus, themes, themeIds, accentSwatches, type ThemeId, type AnimationLevel } from '@/theme';
import { accessibleAccent } from '@/theme/contrast';
import { Button, Card, Header, PressableScale, Screen, SegmentedControl, Text } from '@/ui';
import { FadeInView, HeartbeatView, PulseRing, FloatingHeart, useMotion } from '@/motion';
import { FailureToast, OfflineNotice } from '@/features/presence/Presentation';

const THEME_DESCRIPTIONS: Record<ThemeId, string> = {
  Auto: 'Day / night dynamic',
  Midnight: 'Indigo & warm pink glow',
  Noir: 'AMOLED pitch black & red',
  Rose: 'Soft blush & berry cream',
  Sunset: 'Plum, coral & golden amber',
  Ocean: 'Deep aquatic teal & cyan',
  Lavender: 'Lilac & violet serenity',
  Forest: 'Moss, sage & emerald canopy',
};

function ThemePreview({ id }: { id: ThemeId }) {
  const { colors, surfaces, spacing, radius, geometry, dark } = useTheme();
  const { themeId, accentOverride, setThemeId } = useThemeStore();
  const scheme = useColorScheme();
  const motion = useMotion();
  const base = themes[id === 'Auto' ? scheme === 'dark' ? 'Midnight' : 'Rose' : id];
  const preview = accentOverride ? { ...base, ...accessibleAccent(base, themes[accentOverride]) } : base;
  const selected = themeId === id;

  const scale = useSharedValue(1);
  useEffect(() => {
    if (selected && motion.level === 'full') {
      scale.value = 0.95;
      scale.value = withSpring(1, motion.spring('bouncy'));
    } else {
      scale.value = 1;
    }
  }, [selected, motion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onSelect = () => {
    if (motion.level === 'full') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setThemeId(id);
  };

  return <Animated.View style={[{ flexGrow: 1, flexBasis: '46%' }, animatedStyle]}>
    <PressableScale accessibilityRole="radio" accessibilityLabel={`${id} theme. ${THEME_DESCRIPTIONS[id]}`} accessibilityState={{ checked: selected }} onPress={onSelect}
      style={{
        padding: spacing.md,
        gap: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : geometry.hairline,
        borderColor: selected ? colors.primary : surfaces.rimStrong,
        backgroundColor: preview.bg,
        shadowColor: selected ? colors.primary : colors.shadowColor,
        shadowOffset: { width: 0, height: selected ? 6 : 2 },
        shadowOpacity: selected ? (dark ? 0.45 : 0.22) : (dark ? 0.25 : 0.06),
        shadowRadius: selected ? 14 : 8,
        elevation: selected ? 6 : 2,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title/S" style={{ color: preview.textPrimary }}>{id}</Text>
        {selected ? (
          <View style={{ width: 22, height: 22, borderRadius: radius.pill, backgroundColor: preview.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={14} color={preview.primaryContrast} />
          </View>
        ) : (
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: preview.surfaceAlt, borderWidth: 1, borderColor: `${preview.textSecondary}33` }} />
        )}
      </View>
      <Text variant="caption" style={{ color: preview.textSecondary }}>{THEME_DESCRIPTIONS[id]}</Text>
      <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
        <View style={{ backgroundColor: preview.bubbleTheirs, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, alignSelf: 'flex-start' }}>
          <Text variant="caption" style={{ color: preview.bubbleTheirsText }}>Always with you.</Text>
        </View>
        <View style={{ backgroundColor: preview.primary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, alignSelf: 'flex-end', overflow: 'hidden' }}>
          <LinearGradient pointerEvents="none" colors={[preview.bubbleMineStart, preview.bubbleMineEnd]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text variant="caption" style={{ color: preview.primaryContrast }}>Forever ♥</Text>
        </View>
      </View>
    </PressableScale>
  </Animated.View>;
}

export default function AppearanceScreen() {
  const { colors, surfaces, spacing, radius, geometry } = useTheme();
  const { themeId, accentOverride, animationLevel, setAccentOverride, setAnimationLevel } = useThemeStore();
  const persistenceError = useAppearanceStatus(state => state.persistenceError);
  const motion = useMotion();
  const [heartCount, setHeartCount] = useState(0);

  return <Screen atmosphere bottomInset gradient><Stack.Screen options={{ headerShown: false }} /><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
    <View><Text variant="caption" color="textSecondary">OUR SPACE, YOUR WAY</Text><Header title="Appearance" onBack={() => router.back()} subtitle="A little more you. Changes apply right away." /></View>
    <OfflineNotice message="You’re offline. Appearance changes still apply and save on this phone." /><FailureToast message={persistenceError ?? ''} />
    {!!persistenceError && <Text accessibilityRole="alert" color="danger">{persistenceError}</Text>}

    <View style={{ gap: spacing.xs }}>
      <Text variant="title/M" accessibilityRole="header">Themes for Us</Text>
      <Text variant="body/S" color="textSecondary">Ambient atmosphere & silky animations designed for {themeId}.</Text>
    </View>

    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 }}>
      {themeIds.map(id => <ThemePreview key={id} id={id} />)}
    </View>

    <Card variant="elevated" style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Text variant="title/M" accessibilityRole="header">Accent color</Text>
        <Text variant="body/S" color="textSecondary">Personalize highlights and buttons while keeping text readable.</Text>
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {accentSwatches.map(swatch => {
          const isSelected = accentOverride === swatch.id;
          return <PressableScale key={swatch.id} accessibilityRole="radio" accessibilityLabel={`${swatch.id} accent`} accessibilityState={{ checked: isSelected }} onPress={() => setAccentOverride(swatch.id)}
            style={{ width: geometry.touch, height: geometry.touch, borderRadius: radius.pill, borderWidth: isSelected ? 3 : geometry.hairline, borderColor: isSelected ? colors.textPrimary : surfaces.rimStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: swatch.color }}>
            {isSelected && <Ionicons name="checkmark" size={geometry.icon * 0.75} color={themes[swatch.id].primaryContrast} />}
          </PressableScale>;
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xs }}>
        <Text variant="caption" color="textSecondary">{accentOverride ? `${accentOverride} accent active` : 'Default theme accent'}</Text>
        {accentOverride && <Button title="Reset to default" variant="ghost" onPress={() => setAccentOverride(null)} />}
      </View>
    </Card>

    <Card variant="elevated" style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Text variant="title/M" accessibilityRole="header">Motion & Smoothness</Text>
        <Text variant="body/S" color="textSecondary">Controlled Reanimated physics running on the UI thread at 60/120fps.</Text>
      </View>
      <SegmentedControl<AnimationLevel> options={[{ value: 'full', label: 'Full · 60fps' }, { value: 'reduced', label: 'Reduced' }, { value: 'off', label: 'Off' }]} value={animationLevel} onChange={setAnimationLevel} />
      <Text variant="body/S" color="textSecondary">{motion.systemReduced && animationLevel === 'full' ? 'Phone Reduce Motion is active in system settings.' : animationLevel === 'full' ? 'Organic springs, smooth theme transitions and live reactions.' : animationLevel === 'reduced' ? 'Gentle fades without spatial movement.' : 'Animations settle instantly.'}</Text>

      <PressableScale accessibilityRole="button" accessibilityLabel="Tap for heart pulse" onPress={() => setHeartCount(c => c + 1)} style={{ alignItems: 'center', padding: spacing.md, gap: spacing.sm, backgroundColor: surfaces.softPrimary, borderWidth: geometry.hairline, borderColor: surfaces.rim, borderRadius: radius.lg }}>
        <FloatingHeart trigger={heartCount} />
        <HeartbeatView>
          <PulseRing size={spacing.s56}>
            <Ionicons name="heart" size={geometry.icon * 1.2} color={colors.primary} />
          </PulseRing>
        </HeartbeatView>
        <Text variant="caption" color="textSecondary">Tap to test live reaction animation</Text>
      </PressableScale>
    </Card>
    <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>Appearance preferences are saved locally on this phone.</Text>
  </ScrollView></Screen>;
}

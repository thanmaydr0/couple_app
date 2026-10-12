import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme, type ViewStyle, type TextStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { interpolateColor, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { themes, spacing, radius, typography, geometry, elevations, type ThemeColors, type ColorToken } from './tokens';
import { useThemeStore } from './store';
import { useMotion } from '../motion/useMotion';
import { accessibleAccent } from './contrast';

const initial = themes.Midnight;
let legacyColors: ThemeColors = initial;
/** @deprecated Only for old render-time theme getters; new code uses useTheme(). */
export const getLegacyColors = () => legacyColors;
type ThemeContextValue = {
  colors: ThemeColors; spacing: typeof spacing; radius: typeof radius; typography: typeof typography;
  geometry: typeof geometry; elevations: typeof elevations; dark: boolean;
  previous?: SharedValue<ThemeColors>; target?: SharedValue<ThemeColors>; progress?: SharedValue<number>;
};
const ThemeContext = createContext<ThemeContextValue>({ colors: initial, spacing, radius, typography, geometry, elevations, dark: true });
export function ThemeProvider({ children }: PropsWithChildren) {
  const { themeId, accentOverride } = useThemeStore();
  const scheme = useColorScheme();
  const motion = useMotion();
  const resolved = themeId === 'Auto' ? scheme === 'dark' ? 'Midnight' : 'Rose' : themeId;
  const colors = useMemo<ThemeColors>(() => {
    const base = themes[resolved];
    const swatch = accentOverride ? themes[accentOverride] : null;
    return swatch ? { ...base, ...accessibleAccent(base, swatch) } : base;
  }, [resolved, accentOverride]);
  const previous = useSharedValue<ThemeColors>(colors);
  const target = useSharedValue<ThemeColors>(colors);
  const progress = useSharedValue(1);
  useEffect(() => {
    const current = { ...target.value };
    for (const key of Object.keys(current) as ColorToken[]) current[key] = interpolateColor(progress.value, [0, 1], [previous.value[key], target.value[key]]);
    previous.value = current; target.value = colors; progress.value = 0;
    progress.value = withTiming(1, { duration: motion.duration('theme') });
    legacyColors = colors;
  }, [colors, motion.level, previous, target, progress]);
  const dark = resolved !== 'Rose' && resolved !== 'Lavender';
  return <ThemeContext.Provider value={{ colors, spacing, radius, typography, geometry, elevations, dark, previous, target, progress }}>
    <StatusBar style={dark ? 'light' : 'dark'} />{children}
  </ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
type AnimatedColorProperty = 'backgroundColor' | 'borderColor' | 'color' | 'shadowColor';
/** UI-thread semantic color interpolation, including interrupted theme changes. */
export function useThemeStyle(mapping: Partial<Record<AnimatedColorProperty, ColorToken>>, overrides?: Pick<ViewStyle & TextStyle, AnimatedColorProperty>) {
  const { colors, previous, target, progress } = useTheme();
  return useAnimatedStyle(() => {
    const result: ViewStyle & TextStyle = {};
    for (const property of Object.keys(mapping) as AnimatedColorProperty[]) {
      const key = mapping[property];
      if (key) result[property] = overrides?.[property] ?? (previous && target && progress
        ? interpolateColor(progress.value, [0, 1], [previous.value[key], target.value[key]]) : colors[key]);
    }
    return result;
  }, [mapping, colors, overrides]);
}

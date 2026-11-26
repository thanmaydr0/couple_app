import { createContext, useContext, useEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import { useColorScheme, type ViewStyle, type TextStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { interpolateColor, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { themes, spacing, radius, typography, geometry, elevations, type ThemeColors, type ColorToken, type ThemeId } from './tokens';
import { useThemeStore } from './store';
import { useMotion } from '../motion/useMotion';
import { ThemeTransitionWave } from '../motion/effects';
import { accessibleAccent } from './contrast';

const initial = themes.Midnight;
let legacyColors: ThemeColors = initial;
/** @deprecated Only for old render-time theme getters; new code uses useTheme(). */
export const getLegacyColors = () => legacyColors;

export function hexAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type SurfaceTokens = {
  rim: string;
  rimStrong: string;
  divider: string;
  glassBg: string;
  softPrimary: string;
  softAccent: string;
  glowPrimary: string;
  scrim: string;
};

function computeSurfaces(colors: ThemeColors, dark: boolean): SurfaceTokens {
  return {
    rim: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(52, 32, 41, 0.07)',
    rimStrong: dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(52, 32, 41, 0.14)',
    divider: dark ? 'rgba(255, 255, 255, 0.055)' : 'rgba(52, 32, 41, 0.055)',
    glassBg: hexAlpha(colors.bgElevated, dark ? 0.84 : 0.88),
    softPrimary: hexAlpha(colors.primary, dark ? 0.14 : 0.1),
    softAccent: hexAlpha(colors.accent, dark ? 0.14 : 0.1),
    glowPrimary: hexAlpha(colors.primary, dark ? 0.24 : 0.16),
    scrim: dark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(24, 14, 20, 0.45)',
  };
}

const initialSurfaces = computeSurfaces(initial, true);

type ThemeContextValue = {
  colors: ThemeColors;
  surfaces: SurfaceTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  geometry: typeof geometry;
  elevations: typeof elevations;
  dark: boolean;
  themeId: ThemeId;
  resolvedTheme: ThemeId;
  previous?: SharedValue<ThemeColors>;
  target?: SharedValue<ThemeColors>;
  progress?: SharedValue<number>;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: initial,
  surfaces: initialSurfaces,
  spacing,
  radius,
  typography,
  geometry,
  elevations,
  dark: true,
  themeId: 'Midnight',
  resolvedTheme: 'Midnight',
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const themeId = useThemeStore(s => s.themeId);
  const accentOverride = useThemeStore(s => s.accentOverride);
  const scheme = useColorScheme();
  const motion = useMotion();
  const resolved = themeId === 'Auto' ? (scheme === 'dark' ? 'Midnight' : 'Rose') : themeId;
  const dark = resolved !== 'Rose' && resolved !== 'Lavender';

  const colors = useMemo<ThemeColors>(() => {
    const base = themes[resolved];
    const swatch = accentOverride ? themes[accentOverride] : null;
    return swatch ? { ...base, ...accessibleAccent(base, swatch) } : base;
  }, [resolved, accentOverride]);

  const surfaces = useMemo(() => computeSurfaces(colors, dark), [colors, dark]);

  const previous = useSharedValue<ThemeColors>(colors);
  const target = useSharedValue<ThemeColors>(colors);
  const progress = useSharedValue(1);
  const firstColors = useRef(colors);

  useEffect(() => {
    legacyColors = colors;
    if (firstColors.current === colors && progress.value === 1) return;
    firstColors.current = colors;
    const current = { ...target.value };
    for (const key of Object.keys(current) as ColorToken[]) {
      current[key] = interpolateColor(progress.value, [0, 1], [previous.value[key], target.value[key]]);
    }
    previous.value = current;
    target.value = colors;
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.duration('theme') });
  }, [colors, motion, previous, target, progress]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      surfaces,
      spacing,
      radius,
      typography,
      geometry,
      elevations,
      dark,
      themeId,
      resolvedTheme: resolved,
      previous,
      target,
      progress,
    }),
    [colors, surfaces, dark, themeId, resolved, previous, target, progress]
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ThemeTransitionWave />
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

type AnimatedColorProperty = 'backgroundColor' | 'borderColor' | 'color' | 'shadowColor';

/** UI-thread semantic color interpolation with stabilized primitive dependencies. */
export function useThemeStyle(
  mapping: Partial<Record<AnimatedColorProperty, ColorToken>>,
  overrides?: Pick<ViewStyle & TextStyle, AnimatedColorProperty>
) {
  const { colors, previous, target, progress } = useTheme();
  const bgKey = mapping.backgroundColor;
  const borderKey = mapping.borderColor;
  const colorKey = mapping.color;
  const shadowKey = mapping.shadowColor;
  const ovBg = overrides?.backgroundColor;
  const ovBorder = overrides?.borderColor;
  const ovColor = overrides?.color;
  const ovShadow = overrides?.shadowColor;

  return useAnimatedStyle(() => {
    const result: ViewStyle & TextStyle = {};
    if (bgKey) {
      result.backgroundColor =
        ovBg ?? (previous && target && progress ? interpolateColor(progress.value, [0, 1], [previous.value[bgKey], target.value[bgKey]]) : colors[bgKey]);
    }
    if (borderKey) {
      result.borderColor =
        ovBorder ?? (previous && target && progress ? interpolateColor(progress.value, [0, 1], [previous.value[borderKey], target.value[borderKey]]) : colors[borderKey]);
    }
    if (colorKey) {
      result.color =
        ovColor ?? (previous && target && progress ? interpolateColor(progress.value, [0, 1], [previous.value[colorKey], target.value[colorKey]]) : colors[colorKey]);
    }
    if (shadowKey) {
      result.shadowColor =
        ovShadow ?? (previous && target && progress ? interpolateColor(progress.value, [0, 1], [previous.value[shadowKey], target.value[shadowKey]]) : colors[shadowKey]);
    }
    return result;
  }, [bgKey, borderKey, colorKey, shadowKey, ovBg, ovBorder, ovColor, ovShadow, colors, previous, target, progress]);
}

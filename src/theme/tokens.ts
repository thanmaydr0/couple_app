import source from './tokens.json';
import type { TextStyle } from 'react-native';

export const themes = source.themes;
export type ThemeId = keyof typeof themes;
export type ThemeColors = { [K in keyof typeof themes.Midnight]: string };
export type ColorToken = keyof ThemeColors;
export const themeIds = Object.keys(themes) as ThemeId[];
export const spacing = { xs: 4, sm: 8, s12: 12, md: 16, s20: 20, lg: 24, xl: 32, s40: 40, s56: 56 } as const;
export const radius = { sm: 8, s12: 12, md: 16, lg: 20, sheet: 28, pill: 999 } as const;
export const geometry = { touch: 48, field: 52, icon: 24, stroke: 2, hairline: 1, sheetHandle: 40, sheetHandleHeight: 4, avatar: 48, avatarInitialRatio: 0.4, dot: 8, track: 4, thumb: 24, switchWidth: 52, switchHeight: 32, switchThumb: 24, receipt: 24, receiptLength: 24, firstScreenful: 8, maxParticles: 48, particle: 5, particleTravel: 180, parallax: 0.25, disabledOpacity: 0.4 } as const;
export type TypeVariant = 'display/XL' | 'display/L' | 'display/M' | 'title/L' | 'title/M' | 'title/S' | 'body/L' | 'body/M' | 'body/S' | 'label' | 'caption';
export const typography = Object.fromEntries(source.typeScale.map(t => [t.name, {
  fontFamily: t.font === 'Fraunces' ? 'Fraunces_600SemiBold' : `PlusJakartaSans_${t.weight}${({400:'Regular',500:'Medium',600:'SemiBold',700:'Bold'} as Record<number, string>)[t.weight]}`,
  fontSize: t.size, lineHeight: t.lineHeight, letterSpacing: t.letterSpacing,
}])) as Record<TypeVariant, TextStyle>;
export const elevations = source.elevations;
// Each swatch chooses a complete, contrast-verified primary/ink pair.
export const accentSwatches = themeIds.map(id => ({ id, color: themes[id].primary }));
export type AccentOverride = ThemeId | null;

import type { ThemeColors } from './tokens';
function rgb(hex: string): [number, number, number] { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
function luminance(hex: string) {
  const channels = rgb(hex).map(c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
}
export function contrast(a: string, b: string) { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
/** Preserve hue while keeping primary usable as text/icons on every app surface. */
export function accessibleAccent(base: ThemeColors, swatch: ThemeColors) {
  const surfaces = [base.bg, base.bgElevated, base.surface, base.surfaceAlt];
  const target = luminance(base.bg) > 0.5 ? 0 : 255;
  let primary = swatch.primary;
  for (let step = 0; step <= 100; step++) {
    primary = '#' + rgb(swatch.primary).map(c => Math.round(c + (target - c) * step / 100).toString(16).padStart(2, '0')).join('');
    if (surfaces.every(surface => contrast(primary, surface) >= 4.5)) break;
  }
  const primaryContrast = contrast(primary, '#FFFFFF') >= contrast(primary, '#000000') ? '#FFFFFF' : '#000000';
  return { primary, primaryContrast };
}

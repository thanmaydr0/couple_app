import { StyleSheet } from 'react-native';
import { useTheme } from '@/theme';

export function useMediaStyles() {
  const { colors: c, spacing: p, radius: r, geometry: g, typography: t, elevations } = useTheme();
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    top: { paddingHorizontal: p.lg, paddingTop: p.lg },
    title: { ...t['display/M'], color: c.textPrimary },
    text: { ...t['body/M'], color: c.textPrimary },
    muted: { ...t['body/S'], color: c.textSecondary },
    storage: { marginHorizontal: p.lg, marginBottom: p.md, gap: p.xs },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: p.sm, alignItems: 'center' },
    link: { ...t.label, color: c.primary, paddingHorizontal: p.sm, paddingVertical: p.s12 },
    notice: { ...t['body/S'], padding: p.md, color: c.textSecondary, backgroundColor: c.surface, borderRadius: r.md, marginHorizontal: p.lg, marginBottom: p.sm },
    error: { ...t['body/S'], color: c.danger, padding: p.sm },
    warning: { ...t['body/S'], color: c.warning, padding: p.md, backgroundColor: c.surface, marginHorizontal: p.lg, marginBottom: p.sm, borderRadius: r.md },
    empty: { padding: p.xl, gap: p.md, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: p.lg, paddingVertical: p.sm, overflow: 'hidden' },
    headerText: { ...t.label, color: c.textPrimary },
    grid: { flexDirection: 'row', gap: p.sm, paddingHorizontal: p.lg, paddingVertical: p.xs },
    tile: { flex: 1, minHeight: g.touch, aspectRatio: 0.9, backgroundColor: c.surfaceAlt, justifyContent: 'center', alignItems: 'center', borderRadius: r.s12, overflow: 'hidden', borderWidth: g.hairline, borderColor: c.border },
    tileWrap: { flex: 1 },
    badge: { position: 'absolute', bottom: p.xs, left: p.xs, right: p.xs, borderRadius: r.sm, backgroundColor: c.bgElevated, padding: p.xs, alignItems: 'center' },
    video: { position: 'absolute', top: p.xs, right: p.xs, borderRadius: r.sm, backgroundColor: c.bgElevated, padding: p.xs },
    fab: { position: 'absolute', bottom: p.lg, right: p.lg, width: p.s56, height: p.s56, borderRadius: r.pill, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: g.stroke, borderColor: c.bg, elevation: elevations[2]?.androidDp },
    bar: { paddingHorizontal: p.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pad: { padding: p.lg, gap: p.sm },
    input: { ...t['body/M'], color: c.textPrimary, minHeight: g.field, padding: p.s12, borderColor: c.border, borderWidth: g.hairline, borderRadius: r.s12, backgroundColor: c.surface },
  });
}

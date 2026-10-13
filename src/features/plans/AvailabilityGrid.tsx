import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text, Button } from '@/ui';
import { PressableScale } from '@/motion';
import { useTheme } from '@/theme';
import type { Availability } from './types';
function DayRow({ weekday, selected, onChange }: { weekday: number; selected: Set<string>; onChange: (key: string, value: boolean) => void }) {
  const { colors, spacing, geometry, radius } = useTheme(); const row = useRef<View>(null); const left = useRef(0); const drag = useRef<boolean | null>(null);
  return <View ref={row} onLayout={() => row.current?.measureInWindow(x => { left.current = x; })} onTouchEnd={() => { drag.current = null; }} onTouchCancel={() => { drag.current = null; }} onTouchMove={e => {
    if (drag.current === null) return; const hour = Math.floor((e.nativeEvent.pageX - left.current) / (geometry.touch + spacing.xs));
    if (hour >= 0 && hour < 24) onChange(`${weekday}:${hour}`, drag.current);
  }} style={{ flexDirection: 'row', gap: spacing.xs }}>
    {Array.from({ length: 24 }, (_, hour) => { const key = `${weekday}:${hour}`; const active = selected.has(key); return <PressableScale key={hour} accessibilityRole="checkbox" accessibilityState={{ checked: active }} accessibilityLabel={`${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday]} ${hour}:00–${hour + 1}:00`} onPress={() => onChange(key, !active)} onLongPress={() => { row.current?.measureInWindow(x => { left.current = x; }); drag.current = !active; onChange(key, !active); }} style={{ width: geometry.touch, minHeight: geometry.touch, alignItems: 'center', justifyContent: 'center', borderWidth: geometry.hairline, borderColor: active ? colors.primary : colors.border, borderRadius: radius.sm, backgroundColor: active ? colors.primary : colors.surfaceAlt }}><Text color={active ? 'primaryContrast' : 'textPrimary'} variant="caption">{hour}:00</Text></PressableScale>; })}
  </View>;
}
export function AvailabilityGrid({ rows, zone, userId, onSave, busy }: { rows: Availability[]; zone: string; userId: string; onSave: (cells: Set<string>) => void; busy: boolean }) {
  const { spacing } = useTheme();
  const [selected, setSelected] = useSelection(rows, userId);
  return <View style={{ gap: spacing.md }}><Text>Your weekly free time · {zone}</Text><Text variant="body/S" color="textSecondary">Tap hours, or hold then drag across a day. Free time is shared only after Save. Clear all to stop sharing.</Text>
    <ScrollView horizontal><View style={{ gap: spacing.sm }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, weekday) => <View key={day} style={{ gap: spacing.xs }}><Text variant="label">{day}</Text><DayRow weekday={weekday} selected={selected} onChange={(key, value) => setSelected(old => { const next = new Set(old); if (value) next.add(key); else next.delete(key); return next; })} /></View>)}</View></ScrollView>
    <Button title="Save free time" disabled={busy} onPress={() => onSave(selected)} /><Button title="Clear all / stop sharing" variant="ghost" disabled={busy} onPress={() => { setSelected(new Set()); onSave(new Set()); }} />
  </View>;
}
function useSelection(rows: Availability[], userId: string) {
  return useState(() => { const cells = new Set<string>(); rows.filter(r => r.user_id === userId).forEach(r => { for (let hour = 0; hour < 24; hour++) if (hour * 60 >= r.start_minute && hour * 60 < r.end_minute) cells.add(`${r.weekday}:${hour}`); }); return cells; });
}


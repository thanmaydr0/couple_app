import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Button, Card, PressableScale, Text, TextField } from '@/ui';

/** Feature-local calendar; no native module or dependency installation needed. */
export function DateTimePicker({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const { spacing, geometry, colors, radius } = useTheme();
  const initial = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '2000-01-01';
  const [month, setMonth] = useState(() => new Date(`${initial.slice(0, 7)}-01T12:00:00Z`));
  const year = month.getUTCFullYear(); const number = month.getUTCMonth();
  const offset = new Date(Date.UTC(year, number, 1)).getUTCDay(); const count = new Date(Date.UTC(year, number + 1, 0)).getUTCDate();
  const [open, setOpen] = useState(false);
  const move = (direction: number) => setMonth(new Date(Date.UTC(year, number + direction, 1, 12)));
  const hour = value.slice(11, 13); const minute = value.slice(14, 16);
  const [hourDraft, setHourDraft] = useState(hour); const [minuteDraft, setMinuteDraft] = useState(minute);
  useEffect(() => { setHourDraft(hour); setMinuteDraft(minute); }, [hour, minute]);
  return <View style={{ gap: spacing.sm }}><Button title={open ? 'Close calendar' : 'Choose custom date & time'} disabled={disabled} onPress={() => setOpen(current => !current)} />{open && <Card style={{ gap: spacing.sm, padding: spacing.xs }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Button title="‹" accessibilityLabel="Previous month" disabled={disabled} onPress={() => move(-1)} /><Text variant="label">{month.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'long', year: 'numeric' })}</Text><Button title="›" accessibilityLabel="Next month" disabled={disabled} onPress={() => move(1)} /></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={index} variant="caption" style={{ width: geometry.touch, textAlign: 'center' }}>{day}</Text>)}{Array.from({ length: offset + count }, (_, index) => {
      const day = index - offset + 1; const key = `${year}-${String(number + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return day < 1 ? <View key={index} style={{ width: geometry.touch, height: geometry.touch }} /> : <PressableScale key={index} disabled={disabled} accessibilityRole="button" accessibilityLabel={key} accessibilityState={{ selected: value.startsWith(key) }} onPress={() => onChange(`${key}T${hour || '09'}:${minute || '00'}`)} style={{ width: geometry.touch, height: geometry.touch, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: value.startsWith(key) ? colors.primary : colors.surface }}><Text color={value.startsWith(key) ? 'primaryContrast' : 'textPrimary'}>{day}</Text></PressableScale>;
    })}</View>
    <View style={{ flexDirection: 'row', gap: spacing.sm }}><View style={{ flex: 1 }}><TextField label="Hour (00–23)" value={hourDraft} keyboardType="number-pad" maxLength={2} selectTextOnFocus editable={!disabled} onChangeText={setHourDraft} onBlur={() => onChange(`${value.slice(0, 10)}T${hourDraft.padStart(2, '0')}:${minute || '00'}`)} /></View><View style={{ flex: 1 }}><TextField label="Minute (00–59)" value={minuteDraft} keyboardType="number-pad" maxLength={2} selectTextOnFocus editable={!disabled} onChangeText={setMinuteDraft} onBlur={() => onChange(`${value.slice(0, 10)}T${hour || '09'}:${minuteDraft.padStart(2, '0')}`)} /></View></View>
  </Card>}</View>;
}

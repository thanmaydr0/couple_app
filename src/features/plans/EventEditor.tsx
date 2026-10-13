import { useState } from 'react';
import { View } from 'react-native';
import { Text, TextField, Button } from '@/ui';
import { useTheme } from '@/theme';
import type { EventKind, PlanEvent, Repeat, Window } from './types';
import { DAY, fromWall, wall } from './time';
export type EventDraft = Pick<PlanEvent, 'title' | 'starts_at' | 'ends_at' | 'all_day' | 'location' | 'notes' | 'kind' | 'repeat' | 'remind_minutes' | 'status'>;
export function EventEditor({ event, suggested, zone, idea, busy, onSave, onDelete, counter }: { event?: PlanEvent; suggested?: Window; zone: string; idea?: string; busy: boolean; onSave: (draft: EventDraft) => void; onDelete?: () => void; counter?: boolean }) {
  const { spacing } = useTheme();
  const [title, setTitle] = useState(idea ?? event?.title ?? ''); const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const start = event?.starts_at ?? suggested?.start ?? Date.now();
  const [starts, setStarts] = useState(event?.all_day ? event.starts_at.slice(0, 10) : wall(start, zone));
  const [ends, setEnds] = useState(event?.all_day ? event.ends_at.slice(0, 10) : wall(event?.ends_at ?? suggested?.end ?? Date.now() + 60 * 60_000, zone));
  const [location, setLocation] = useState(event?.location ?? ''); const [notes, setNotes] = useState(event?.notes ?? ''); const [repeat, setRepeat] = useState<Repeat>(event?.repeat ?? 'none'); const [kind, setKind] = useState<EventKind>(event?.kind ?? (idea ? 'date' : 'custom')); const [remind, setRemind] = useState(event?.remind_minutes.join(',') ?? '60'); const [error, setError] = useState('');
  const save = (proposed: boolean) => { try {
    if (!title.trim()) throw new Error('Give your plan a title.');
    const parse = (value: string) => allDay ? fromWall(`${value.slice(0, 10)}T00:00`, 'UTC') : fromWall(value, zone);
    const a = parse(starts), b = parse(ends); if (b <= a || (allDay && (b - a) % DAY !== 0)) throw new Error('End must be after start; all-day end is the following date.');
    const minutes = remind.trim() ? [...new Set(remind.split(',').map(v => Number(v.trim())))] : [];
    if (minutes.length > 5 || minutes.some(n => !Number.isInteger(n) || n < 0 || n > 10080)) throw new Error('Use up to 5 reminder offsets, between 0 and 10080 minutes.');
    onSave({ title: title.trim(), starts_at: new Date(a).toISOString(), ends_at: new Date(b).toISOString(), all_day: allDay, location: location.trim() || null, notes: notes.trim() || null, kind, repeat, remind_minutes: minutes, status: proposed ? 'proposed' : 'confirmed' });
  } catch (e) { setError(e instanceof Error ? e.message : 'Check your plan.'); } };
  return <View style={{ gap: spacing.md }}><TextField label="Title" value={title} onChangeText={setTitle} maxLength={160} />
    <Button title={allDay ? 'All-day · on' : 'All-day · off'} variant="ghost" disabled={busy} onPress={() => { try { const date = starts.slice(0, 10); const nextDay = new Date(fromWall(`${date}T00:00`, 'UTC') + DAY).toISOString().slice(0, 10); setAllDay(!allDay); setStarts(allDay ? `${date}T09:00` : date); setEnds(allDay ? `${date}T10:00` : nextDay); } catch { setError('Enter a valid start date before changing all-day mode.'); } }} />
    <Text variant="body/S" color="textSecondary">{allDay ? 'Same calendar dates for both partners. End date is exclusive.' : `Times in ${zone}. Use YYYY-MM-DDTHH:mm.`}</Text>
    <TextField label={allDay ? 'Start date (YYYY-MM-DD)' : 'Starts'} value={starts} onChangeText={setStarts} autoCapitalize="none" /><TextField label={allDay ? 'End date (exclusive)' : 'Ends'} value={ends} onChangeText={setEnds} autoCapitalize="none" />
    <TextField label="Location (optional, shared with partner)" value={location} onChangeText={setLocation} maxLength={300} /><TextField label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={2000} />
    <Text variant="label">Kind · {kind}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{(['date', 'meet', 'anniversary', 'birthday', 'reminder', 'custom'] as const).map(k => <Button key={k} title={k} variant={kind === k ? 'primary' : 'ghost'} onPress={() => setKind(k)} />)}</View>
    <Text variant="label">Repeat · {repeat}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{(['none', 'weekly', 'monthly', 'yearly'] as const).map(r => <Button key={r} title={r} variant={repeat === r ? 'primary' : 'ghost'} onPress={() => setRepeat(r)} />)}</View>
    {event && <Text variant="caption">Editing or deleting a repeat applies to the whole series.</Text>}
    <TextField label="Reminders (minutes before, comma-separated; blank for none)" value={remind} onChangeText={setRemind} keyboardType="numbers-and-punctuation" />
    {error !== '' && <Text color="danger" accessibilityLiveRegion="polite">{error}</Text>}
    <Button title={counter ? 'Send counterproposal' : 'Propose to partner'} disabled={busy} onPress={() => save(true)} />
    {!counter && event?.status !== 'proposed' && <Button title="Save confirmed plan" variant="secondary" disabled={busy} onPress={() => save(false)} />}
    {onDelete && <Button title="Delete event / series" variant="danger" disabled={busy} onPress={onDelete} />}
  </View>;
}

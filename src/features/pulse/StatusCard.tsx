import { useEffect, useState } from 'react';
import { View, TextInput } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { PressableScale, HeartbeatView } from '@/motion';
import { Card, Text, Button } from '@/ui';
import { moods, moodEmoji, availabilities, type Mood, type Availability, type Status } from './types';
import { setStatus } from './service';
export function StatusCard({ own, partner, offline }: { own?: Status; partner?: Status; offline: boolean }) {
  const { spacing, radius, colors, geometry, typography } = useTheme(); const client = useQueryClient();
  const [mood, setMood] = useState<Mood>(own?.mood ?? 'calm'); const [availability, setAvailable] = useState<Availability>(own?.availability ?? 'free'); const [note, setNote] = useState(own?.note ?? '');
  useEffect(() => { if (own) { setMood(own.mood); setAvailable(own.availability); setNote(own.note ?? ''); } }, [own?.updated_at]);
  const save = useMutation({ mutationFn: ({ m, a, n }: { m: Mood; a: Availability; n: string }) => setStatus(m, a, n), onSuccess: () => client.invalidateQueries({ queryKey: ['pulse'] }) });
  const busy = offline || save.isPending;
  return <Card style={{ gap: spacing.md }}><Text variant="title/M">How are you, really?</Text><Text color="textSecondary">Partner: {partner ? `${moodEmoji[moods.indexOf(partner.mood)]} ${partner.mood} · ${partner.availability}${partner.note ? ` · ${partner.note}` : ''}` : 'No check-in yet'}</Text>{partner && <Text variant="caption" color="textSecondary">Last check-in: {new Date(partner.updated_at).toLocaleString()}</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{moods.map((m, i) => <PressableScale key={m} accessibilityRole="button" accessibilityLabel={`Feeling ${m}`} accessibilityState={{ selected: mood === m }} disabled={busy} onPress={() => { setMood(m); save.mutate({ m, a: availability, n: note }); }} style={{ minHeight: geometry.touch, padding: spacing.sm, borderRadius: radius.md, backgroundColor: mood === m ? colors.bgElevated : colors.surfaceAlt }}><HeartbeatView><Text>{moodEmoji[i]} {m}</Text></HeartbeatView></PressableScale>)}</View>
    <Text variant="label">Availability</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{availabilities.map(a => <Button key={a} title={a} variant={availability === a ? 'primary' : 'secondary'} disabled={busy} onPress={() => { setAvailable(a); save.mutate({ m: mood, a, n: note }); }} />)}</View>
    <TextInput accessibilityLabel="Optional status note" placeholder="Anything you want them to know?" placeholderTextColor={colors.textSecondary} value={note} maxLength={240} editable={!busy} onChangeText={setNote} style={{ ...typography['body/M'], minHeight: geometry.touch, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, color: colors.textPrimary }} /><Button title="Save note" loading={save.isPending} disabled={offline} onPress={() => save.mutate({ m: mood, a: availability, n: note })} />{save.isError && <Text color="danger">Could not save check-in. Your draft is still here; try again.</Text>}
  </Card>;
}

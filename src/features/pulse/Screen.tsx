import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, View, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Screen, Header, Card, Text, Button, ErrorState, EmptyState } from '@/ui';
import { FadeInView } from '@/motion';
import { useTheme } from '@/theme';
import { usePulse } from './usePulse';
import { questionFor, streak } from './calendar';
import { pulseDb, notifyPulse } from './service';
import { StatusCard } from './StatusCard';
import { HeartButton } from './HeartButton';
import { TheirDay } from './TheirDay';
export default function PulseScreen() {
  const pulse = usePulse(); const { spacing, radius, colors, geometry, typography } = useTheme(); const client = useQueryClient();
  const [draft, setDraft] = useState(''); const [history, setHistory] = useState(false); const [notice, setNotice] = useState(''); const [page, setPage] = useState(20);
  useEffect(() => { setDraft(''); setNotice(''); }, [pulse.day, pulse.userId]);
  useEffect(() => { if (!history) return; const sub = BackHandler.addEventListener('hardwareBackPress', () => { setHistory(false); return true; }); return () => sub.remove(); }, [history]);
  const answers = pulse.data?.answers ?? []; const today = answers.filter(a => a.day === pulse.day); const mine = today.find(a => a.user_id === pulse.userId); const theirs = today.find(a => a.user_id !== pulse.userId);
  const completedDays = [...new Set(answers.map(a => a.day))].filter(day => new Set(answers.filter(a => a.day === day).map(a => a.user_id)).size >= 2);
  const days = [...new Set(answers.filter(a => a.day < pulse.day).map(a => a.day))];
  const submit = useMutation({ mutationFn: async () => {
    if (!pulse.userId || !pulse.coupleId || !draft.trim()) throw new Error('Write an answer first.');
    const day = pulse.day; const { error } = await pulseDb.from('pulse_answers').insert({ couple_id: pulse.coupleId, user_id: pulse.userId, day, answer: draft.trim() });
    if (error) throw error;
    await client.invalidateQueries({ queryKey: ['pulse'] }); setDraft('');
    try { await notifyPulse(`pulse:answer:${pulse.coupleId}:${pulse.userId}:${day}`, "They answered today's question — your turn!", 24 * 60 * 60_000); } catch { setNotice('Answer saved. The notification could not be delivered.'); }
  } });
  return <Screen bottomInset><Header title={history ? 'Our daily pages' : 'Pulse'} subtitle="One small moment, just for us" onBack={() => history ? setHistory(false) : router.back()} /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
    {pulse.offline && <Text accessibilityLiveRegion="polite" color="textSecondary">Offline · showing saved information. Reconnect to send.</Text>}
    {pulse.profileError || (pulse.error && !pulse.data) ? <ErrorState description="Pulse could not load. Check your connection and try again." onRetry={() => { void pulse.refetch(); void client.invalidateQueries({ queryKey: ['profile'] }); void client.invalidateQueries({ queryKey: ['couple'] }); }} /> : pulse.profileLoading ? <Text accessibilityRole="progressbar">Loading your couple…</Text> : !pulse.coupleId ? <EmptyState title="A moment for two" description="Link your couple in Settings to start Pulse." actionLabel="Open Settings" onAction={() => router.push('/settings')} /> : pulse.isPending ? <Text accessibilityRole="progressbar">{pulse.offline ? 'No saved Pulse yet. Reconnect to load it.' : 'Opening your daily pages…'}</Text> : <>
      {pulse.error && <ErrorState description="Showing saved Pulse. The latest update could not load." onRetry={() => { void pulse.refetch(); }} />}
      <Text variant="label">{streak(completedDays, pulse.day)} day shared streak · {pulse.data?.thoughts ?? 0} thoughts of you today</Text>
      {history ? <>{days.length === 0 && <EmptyState title="Your story starts today" description="Past questions and answers will appear here, even if only one of you answered." />}{days.slice(0, page).map(day => <Card key={day} style={{ gap: spacing.md }}><Text variant="caption" color="textSecondary">{day}</Text><Text variant="title/S">{questionFor(day)}</Text>{answers.filter(a => a.day === day).map(a => <View key={a.id} style={{ gap: spacing.xs }}><Text variant="label">{a.user_id === pulse.userId ? 'You' : 'Them'}</Text><Text>{a.answer}</Text></View>)}{answers.filter(a => a.day === day).length < 2 && <Text color="textSecondary">One of you left this page unwritten.</Text>}</Card>)}{days.length > page && <Button title="Older pages" onPress={() => setPage(p => p + 20)} />}</> : <>
        <Card style={{ gap: spacing.md }}><Text variant="label">TODAY · {pulse.day}</Text><Text variant="title/M">{questionFor(pulse.day)}</Text>
          {mine && theirs ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: spacing.sm }}>{[mine, theirs].map((a, index) => <FadeInView key={a.id} style={{ flex: 1 }}><Card style={{ gap: spacing.sm, flex: 1 }}><Text variant="label">{index === 0 ? 'You' : 'Them'}</Text><Text>{a.answer}</Text></Card></FadeInView>)}</View> : mine ? <><Text>Your answer: {mine.answer}</Text><Text accessibilityLiveRegion="polite">✉ Waiting for them…</Text><Text color="textSecondary">Their envelope opens when they answer too.</Text></> : <>
            <Text color="textSecondary">Your answers stay sealed until you both answer. Past days open for both of you.</Text><TextInput key={pulse.day} accessibilityLabel="Your answer to today's question" multiline maxLength={2000} value={draft} onChangeText={setDraft} editable={!pulse.offline && !submit.isPending} placeholder="A little honesty goes a long way…" placeholderTextColor={colors.textSecondary} style={{ ...typography['body/M'], color: colors.textPrimary, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, minHeight: geometry.touch * 2, textAlignVertical: 'top' }} /><Button title="Seal my answer" loading={submit.isPending} disabled={pulse.offline || !draft.trim()} onPress={() => { setNotice(''); submit.mutate(); }} /><Text variant="caption" color="textSecondary">Answers cannot be edited after sealing.</Text>{submit.isError && <Text color="danger">Could not seal your answer. Refresh to check whether it saved, then retry.</Text>}
          </>}{notice && <Text color="textSecondary">{notice}</Text>}
        </Card><Button title="Our question history" variant="secondary" onPress={() => setHistory(true)} />
        <StatusCard own={pulse.data?.statuses.find(s => s.user_id === pulse.userId)} partner={pulse.data?.statuses.find(s => s.user_id !== pulse.userId)} offline={pulse.offline} />
        <Card style={{ gap: spacing.md }}><Text variant="title/M">Thinking of you</Text><HeartButton disabled={pulse.offline} /></Card><TheirDay now={pulse.now} offline={pulse.offline} />
      </>}
    </>}
  </ScrollView></Screen>;
}

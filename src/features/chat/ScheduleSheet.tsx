import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { BottomSheet, ListItem } from '@/ui';
import { PressableScale } from '@/motion';
import { useTheme } from '@/theme';
import { decodeBody } from './body';
import { cancelSchedule, saveSchedule } from './plusService';
import type { ScheduledMessage } from './types';
import { useChatStyles } from './styles';

function preset(hour: number, tomorrow = true): Date { const date = new Date(); if (tomorrow) date.setDate(date.getDate()+1); date.setHours(hour,0,0,0); if (date.getTime() <= Date.now()) date.setDate(date.getDate()+1); return date; }
export function ScheduleSheet({ visible, onClose, couple, uid, draft, replyTo, jobs, loading, error: loadError, refresh, onSaved }: {
  visible: boolean; onClose: () => void; couple: string; uid: string; draft: string; replyTo: string | null;
  jobs: ScheduledMessage[]; loading: boolean; error: boolean; refresh: () => Promise<unknown>; onSaved: () => void;
}) {
  const styles = useChatStyles(); const { colors, spacing, geometry, typography } = useTheme();
  const [body, setBody] = useState(draft); const [date, setDate] = useState(preset(8)); const [existing, setExisting] = useState<string>();
  const [recurring, setRecurring] = useState(false); const [phrases, setPhrases] = useState('Good morning, my love!\nA little hello to start your day.');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(preset(8)); const [picker, setPicker] = useState(false);
  useEffect(() => { if (visible) { setBody(draft); setExisting(undefined); setDate(preset(8)); setMonth(preset(8)); setRecurring(false); setError(null); } }, [visible, draft]);
  const run = async (action: () => Promise<void>) => { if (busy) return; setBusy(true); setError(null); try { await action(); await refresh(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Unable to update schedule. Try when online.'); } finally { setBusy(false); } };
  const setPreset = (hour: number) => { const next = preset(hour); setDate(next); setMonth(next); };
  const changeTime = (field: 'hour' | 'minute', delta: number) => { const next = new Date(date); if (field === 'hour') next.setHours((next.getHours()+delta+24)%24); else next.setMinutes((next.getMinutes()+delta+60)%60); setDate(next); };
  const days = new Date(month.getFullYear(), month.getMonth()+1,0).getDate(); const offset = new Date(month.getFullYear(),month.getMonth(),1).getDay();
  return <BottomSheet visible={visible} onClose={onClose} title="Scheduled messages">
    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: geometry.touch * 10 }} contentContainerStyle={{ gap: spacing.sm }}>
      <Text style={styles.subtitle}>Hold Send to choose a time. Encrypted daily messages queue the next 30 days on this phone; each occurrence can be edited or cancelled separately.</Text>
      <TextInput accessibilityLabel="Scheduled message" value={body} onChangeText={setBody} multiline maxLength={4000} style={styles.input} placeholder="A message for later…" placeholderTextColor={colors.textSecondary} />
      <ListItem title="Tomorrow 8:00 AM" onPress={() => setPreset(8)} />
      <ListItem title="Tomorrow 10:00 PM" onPress={() => setPreset(22)} />
      <ListItem title={date.toLocaleString()} subtitle="Choose date and time" onPress={() => { setMonth(date); setPicker(!picker); }} />
      {picker && <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <PressableScale accessibilityLabel="Previous month" onPress={() => setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><Text style={styles.body}>‹</Text></PressableScale>
          <Text style={styles.body}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <PressableScale accessibilityLabel="Next month" onPress={() => setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><Text style={styles.body}>›</Text></PressableScale>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Array.from({ length: offset+days }, (_, index) => {
          const day = index-offset+1;
          const picked = day === date.getDate() && month.getMonth() === date.getMonth() && month.getFullYear() === date.getFullYear();
          return day < 1 ? <View key={index} style={{ width: `${100/7}%`, minHeight: geometry.touch }} /> : <PressableScale key={index} accessibilityLabel={`${month.toLocaleDateString(undefined,{month:'long',year:'numeric'})} ${day}`} accessibilityState={{ selected: picked }} style={{ width: `${100/7}%`, alignItems: 'center', justifyContent: 'center', backgroundColor: picked ? colors.primary : colors.surface }} onPress={() => { const next = new Date(date); next.setFullYear(month.getFullYear(),month.getMonth(),day); setDate(next); }}><Text style={{ ...typography.label, color: picked ? colors.primaryContrast : colors.textPrimary }}>{day}</Text></PressableScale>;
        })}</View>
        <Text style={styles.subtitle}>Time (24-hour, device timezone)</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <PressableScale accessibilityLabel="Hour earlier" onPress={() => changeTime('hour',-1)}><Text style={styles.body}>− hour</Text></PressableScale>
          <Text style={styles.body}>{String(date.getHours()).padStart(2,'0')}:{String(date.getMinutes()).padStart(2,'0')}</Text>
          <PressableScale accessibilityLabel="Hour later" onPress={() => changeTime('hour',1)}><Text style={styles.body}>+ hour</Text></PressableScale>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><PressableScale onPress={() => changeTime('minute',-1)}><Text style={styles.body}>− minute</Text></PressableScale><PressableScale onPress={() => changeTime('minute',1)}><Text style={styles.body}>+ minute</Text></PressableScale></View>
      </View>}
      <ListItem title={`Repeat daily: ${recurring ? 'On' : 'Off'}`} subtitle="Off by default. Random message from your editable list." onPress={() => setRecurring(!recurring)} />
      {recurring && <>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}><PressableScale onPress={() => { setPreset(8); setPhrases('Good morning, my love!\nA little hello to start your day.'); }}><Text style={styles.body}>Good morning</Text></PressableScale><PressableScale onPress={() => { setPreset(22); setPhrases('Good night, my love!\nSweet dreams. Thinking of you.'); }}><Text style={styles.body}>Good night</Text></PressableScale></View>
        <TextInput accessibilityLabel="Daily messages, one per line" value={phrases} onChangeText={setPhrases} multiline maxLength={12000} style={styles.input} />
      </>}
      {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
      <ListItem title={busy ? 'Saving…' : existing ? 'Save changes' : 'Schedule message'} disabled={busy || !body.trim()} onPress={() => void run(async () => { await saveSchedule(couple,uid,body,date,replyTo,existing,phrases.split('\n'),recurring); setBody(''); setExisting(undefined); onSaved(); })} />
      {existing && <ListItem title="Cancel editing" onPress={() => { setExisting(undefined); setBody(''); }} />}
      {loading && <ActivityIndicator color={colors.primary} />}
      {loadError && <ListItem title="Schedules unavailable · retry" onPress={() => void refresh()} />}
      {!loading && !jobs.length && <Text style={styles.subtitle}>No scheduled messages yet.</Text>}
      {jobs.map(job => <View key={job.id}>
        <ListItem title={decodeBody(job.payload.body) || 'Scheduled message'} subtitle={`${new Date(job.run_at).toLocaleString()} · ${job.sent_at ? 'Sent · push delivery needs attention' : job.status === 'failed' ? 'Delivery needs attention' : job.locked_until ? 'Sending' : job.payload.recurrence ? 'Repeats daily · not sent yet' : 'Not sent yet'}`} />
        {job.status === 'pending' && !job.locked_until && !job.sent_at && <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <PressableScale disabled={busy} onPress={() => { setExisting(job.id); setBody(decodeBody(job.payload.body)); setDate(new Date(job.run_at)); setRecurring(!!job.payload.recurrence); setPhrases(job.payload.phrases?.join('\n') ?? decodeBody(job.payload.body)); }}><Text style={styles.body}>Edit</Text></PressableScale>
          <PressableScale disabled={busy} onPress={() => void run(() => cancelSchedule(job))}><Text style={styles.errorText}>Cancel</Text></PressableScale>
        </View>}
      </View>)}
    </ScrollView>
  </BottomSheet>;
}

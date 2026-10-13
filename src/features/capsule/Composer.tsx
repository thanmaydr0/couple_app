import { VoiceRecorder, VoicePlayer, type VoiceRecording } from '@/features/voice';
import { persistVoice } from '@/features/voice/storage';
import { useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Image, ScrollView, View } from 'react-native';
import { Button, Card, Chip, Header, Screen, Switch, Text, TextField, PressableScale } from '@/ui';
import { useTheme } from '@/theme';
import { useCouple, usePartner, useProfile } from '@/lib/hooks';
import { coupleTimezone, zonedTimeToUtc } from '@/lib/couple-time';
import { pickPhotos, saveCapsule } from './service';
import type { Capsule, CapsuleKind } from './types';
import { DateTimePicker } from './DateTimePicker';

function localInput(instant: Date, zone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const get = (key: string) => parts.find(part => part.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
function birthdayOf(value: unknown): string | undefined {
  return value && typeof value === 'object' && 'birthday' in value && typeof value.birthday === 'string' ? value.birthday : undefined;
}
export function Composer({ existing, serverNow, offline, onClose, onSaved }: { existing?: Capsule; serverNow: string; offline: boolean; onClose: () => void; onSaved: () => void }) {
  const { spacing, geometry, radius } = useTheme();
  const { data: profile } = useProfile(); const { data: couple } = useCouple(); const { data: partner } = usePartner();
  const zone = coupleTimezone(couple);
  const [title, setTitle] = useState(existing?.title ?? ''); const [body, setBody] = useState(existing?.body ?? '');
  const [kind, setKind] = useState<CapsuleKind>(existing?.kind ?? 'letter');
  const [together, setTogether] = useState(existing?.open_together ?? false);
  const [years, setYears] = useState('1');
  const [date, setDate] = useState(localInput(existing ? new Date(existing.unlock_at) : new Date(new Date(serverNow).getTime() + 86400_000), zone));
  const [photos, setPhotos] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [voice, setVoice] = useState<VoiceRecording>();
  const voiceRef = useRef<VoiceRecording | undefined>(undefined);
  useEffect(() => () => { if (voiceRef.current) void FileSystem.deleteAsync(voiceRef.current.uri, { idempotent: true }); }, []);
  const [recording, setRecording] = useState(false);
  const count = photos.length + (existing?.media_paths.length ?? 0);
  const report = (cause: unknown) => setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
  const quick = (choice: 'tomorrow' | 'year' | 'anniversary' | 'birthday', future = false) => {
    try {
      const today = localInput(new Date(serverNow), zone).slice(0, 10);
      const base = new Date(`${today}T12:00:00Z`);
      if (choice === 'tomorrow') base.setUTCDate(base.getUTCDate() + 1);
      else if (choice === 'year') base.setUTCFullYear(base.getUTCFullYear() + 1);
      else {
        const value = choice === 'anniversary' ? couple?.anniversary : birthdayOf(partner);
        if (!value) throw new Error(`Your ${choice === 'birthday' ? 'partner’s birthday' : 'anniversary'} has not been saved yet. Choose a custom date.`);
        const monthDay = value.slice(5, 10);
        const year = Number(today.slice(0, 4));
        base.setTime(new Date(`${year}-${monthDay}T12:00:00Z`).getTime());
        if (base.toISOString().slice(0, 10) <= today) base.setUTCFullYear(year + 1);
        if (future) {
          const n = Number(years);
          if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('Choose between 1 and 100 years.');
          base.setUTCFullYear(year + n);
        }
      }
      setDate(`${base.toISOString().slice(0, 10)}T09:00`); setError('');
    } catch (cause) { report(cause); }
  };
  const save = async () => {
    if (busy || recording || offline || !profile?.couple_id) return;
    setBusy(true); setError('');
    try {
      const unlock = zonedTimeToUtc(date, zone);
      if (unlock.getTime() <= new Date(serverNow).getTime()) throw new Error('Choose a future moment. The server checks the time again when saving.');
      if (!body.trim() && !photos.length && !existing?.media_paths.length && !voice && !existing?.voice_path) throw new Error('Write a message, add a photo or record your voice.');
      await saveCapsule(profile.couple_id, profile.id, { title: title.trim(), body, kind, open_together: together, unlock_at: unlock.toISOString() }, photos, existing, voice);
      onSaved();
    } catch (cause) { report(cause); } finally { setBusy(false); }
  };
  return <Screen bottomInset><Header title={existing ? 'Your sealed capsule' : 'A little gift for later'} subtitle="Words worth waiting for" onBack={() => { if (!busy) onClose(); }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
      {offline && <Text color="danger">Offline · your draft stays here. Reconnect before sealing.</Text>}
      <TextField label="Title (hidden until opened)" value={title} onChangeText={setTitle} maxLength={160} editable={!busy} />
      <TextField label="Your message" multiline textAlignVertical="top" value={body} onChangeText={setBody} maxLength={30000} editable={!busy} style={{ minHeight: geometry.touch * 4 }} hint="Line breaks and paragraphs are preserved." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{(['letter', 'surprise', 'future_us'] as const).map(value => <Chip key={value} label={value === 'future_us' ? 'Future us' : value === 'letter' ? 'Letter' : 'Surprise'} selected={kind === value} disabled={busy} onPress={() => setKind(value)} />)}</View>
      {kind === 'future_us' && <Card><TextField label="Our anniversary in N years" value={years} onChangeText={setYears} keyboardType="number-pad" editable={!busy} /><Button title="Choose that anniversary" disabled={busy} onPress={() => quick('anniversary', true)} /></Card>}
      <Text variant="title/S">Choose a moment</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{(['tomorrow', 'anniversary', 'birthday', 'year'] as const).map(value => <Chip key={value} label={{ tomorrow: 'Tomorrow', anniversary: 'Next anniversary', birthday: 'Next birthday', year: '1 year' }[value]} disabled={busy} onPress={() => quick(value)} />)}</View>
      <DateTimePicker value={date} onChange={setDate} disabled={busy} />
      <TextField label={`Date & time · ${zone}`} value={date} onChangeText={setDate} editable={!busy} autoCapitalize="none" placeholder="YYYY-MM-DDTHH:mm" hint="24-hour time. Saved as one UTC instant, so travel won’t change the opening moment." />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}><View style={{ flex: 1 }}><Text variant="title/S">Open together</Text><Text variant="body/S" color="textSecondary">Both of you hold the seal at the same time.</Text></View><Switch value={together} onValueChange={setTogether} disabled={busy} accessibilityLabel="Open together" /></View>
      <Text>{count} / 6 photos{existing?.media_paths.length ? ' · existing photos are kept' : ''}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{photos.map((uri, index) => <PressableScale key={uri} disabled={busy} accessibilityLabel={`Remove new photo ${index + 1}`} onPress={() => setPhotos(current => current.filter(item => item !== uri))}><Image source={{ uri }} style={{ width: geometry.touch * 2, height: geometry.touch * 2, borderRadius: radius.md }} /><Text variant="caption">Remove</Text></PressableScale>)}</View>
      <Button title="Add photos" disabled={busy || offline || count >= 6} onPress={() => { setBusy(true); void pickPhotos(6 - count).then(items => setPhotos(current => [...current, ...items])).catch(report).finally(() => setBusy(false)); }} />
      <Text variant="title/S">Record a voice message</Text>
      <VoiceRecorder disabled={busy || !profile?.couple_id} onBusyChange={setRecording} onRecorded={async result => { if (!profile?.couple_id) throw new Error('Sign in first.'); const saved = await persistVoice(result, profile.couple_id, profile.id, 'capsule'); if (voiceRef.current) await FileSystem.deleteAsync(voiceRef.current.uri, { idempotent: true }); voiceRef.current = { uri: saved.uri, meta: saved.meta }; setVoice(voiceRef.current); }} />
      {voice ? <VoicePlayer id={voice.uri} uri={voice.uri} meta={voice.meta} /> : existing?.voice_path ? <VoicePlayer id={existing.id} path={existing.voice_path} bucket="capsules" /> : null}
      <Text variant="caption" color="textSecondary">Sealed content stays private until the server unlocks it.</Text>
      {!!error && <Text color="danger" accessibilityLiveRegion="polite">{error}</Text>}
      <Button title={busy ? 'Sealing…' : existing ? 'Save capsule' : 'Seal for later'} disabled={busy || recording || offline} onPress={() => void save()} />
      <Button title="Discard draft" disabled={busy} onPress={() => Alert.alert('Discard this draft?', 'Unsaved changes will be lost.', [{ text: 'Keep writing' }, { text: 'Discard', style: 'destructive', onPress: onClose }])} />
    </ScrollView></Screen>;
}

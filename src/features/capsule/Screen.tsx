import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/theme';
import { StaggerList } from '@/motion';
import { Button, Card, EmptyState, ErrorState, Header, PressableScale, Screen, SegmentedControl, Skeleton, Text } from '@/ui';
import { useCapsules } from './useCapsules';
import { countdown, deleteCapsule } from './service';
import { Composer } from './Composer';
import { Ceremony, WaxSeal } from './Ceremony';
import type { Capsule } from './types';

export function CapsuleScreen() {
  const { spacing } = useTheme(); const query = useCapsules();
  const [tab, setTab] = useState<'received' | 'authored'>('received'); const [composer, setComposer] = useState(false); const [editing, setEditing] = useState<Capsule>();
  const [ceremony, setCeremony] = useState<{ id: string; together: boolean }>(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const { capsule_id } = useLocalSearchParams<{ capsule_id?: string }>(); const [handledLink, setHandledLink] = useState<string>();
  useEffect(() => {
    if (!capsule_id || handledLink === capsule_id || !query.data) return;
    const stub = query.data.received.find(item => item.id === capsule_id);
    if (stub?.ready) { setCeremony({ id: stub.id, together: stub.open_together }); setHandledLink(capsule_id); }
  }, [capsule_id, handledLink, query.data]);
  const close = () => { setComposer(false); setEditing(undefined); setCeremony(undefined); void query.refetch(); };
  if (ceremony) return <Ceremony id={ceremony.id} together={ceremony.together} onClose={close} />;
  if (composer && query.data) return <Composer existing={editing} serverNow={query.data.serverNow} offline={query.offline} onClose={close} onSaved={close} />;
  const remove = (capsule: Capsule) => Alert.alert('Delete this sealed capsule?', 'Its message and photos will be removed. This cannot be undone.', [{ text: 'Keep capsule' }, { text: 'Delete', style: 'destructive', onPress: () => {
    setBusy(true); setError(''); void deleteCapsule(capsule).then(() => query.refetch()).catch(() => setError('Could not delete this capsule. It may already be unlocked.')).finally(() => setBusy(false));
  } }]);
  return <Screen bottomInset><Header title="Time Capsule" subtitle="A little love, saved for later" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
      {query.offline && <Text color="danger">Offline · saved previews may be out of date. Reconnect to write or open.</Text>}
      <SegmentedControl options={[{ value: 'received', label: 'Sealed for you' }, { value: 'authored', label: 'You wrote' }]} value={tab} onChange={setTab} />
      <Button title="Write a capsule" disabled={!query.data || query.offline || busy} onPress={() => { setEditing(undefined); setComposer(true); }} />
      <Text variant="caption" color="textSecondary">Return at the chosen moment to open your capsule. The app checks the seal whenever you return.</Text>
      {query.isLoading && <Skeleton />}
      {query.isError && <ErrorState title="Couldn’t refresh capsules" description="Your saved previews are still here. Check your connection and try again." onRetry={() => { void query.refetch(); }} />}
      {!!error && <Text color="danger" accessibilityLiveRegion="polite">{error}</Text>}
      {query.data && <StaggerList style={{ gap: spacing.md }}>{tab === 'received' ? query.data.received.map(stub => <PressableScale key={stub.id} accessibilityRole="button" disabled={!stub.ready || query.offline} onPress={() => setCeremony({ id: stub.id, together: stub.open_together })}>
        <Card style={{ gap: spacing.md }}><View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}><WaxSeal ready={stub.ready} /><View style={{ flex: 1 }}><Text variant="title/S">{stub.title_hint || `A sealed ${stub.kind === 'future_us' ? 'message for future us' : stub.kind} from them`}</Text><Text>{stub.opened_at ? 'Open again' : countdown(stub.unlock_at, query.data!.serverNow)}</Text></View></View>
          <Text variant="caption" color="textSecondary">{new Date(stub.unlock_at).toLocaleString()}{stub.open_together ? ' · Open together' : ''}{stub.has_media ? ' · A little extra inside' : ''}</Text>
        </Card></PressableScale>) : query.data.authored.map(capsule => {
          const sealed = new Date(capsule.unlock_at) > new Date(query.data!.serverNow);
          return <Card key={capsule.id} style={{ gap: spacing.md }}><Text variant="title/S">{capsule.title || 'Your capsule'}</Text><Text>{countdown(capsule.unlock_at, query.data!.serverNow)}</Text><Text variant="caption" color="textSecondary">{new Date(capsule.unlock_at).toLocaleString()}{capsule.open_together ? ' · Open together' : ''}</Text>
            {sealed ? <><Button title="Edit" disabled={query.offline || busy} onPress={() => { setEditing(capsule); setComposer(true); }} /><Button title="Delete" disabled={query.offline || busy} onPress={() => remove(capsule)} /></> : <Button title={capsule.opened_at ? 'Read again' : 'Open capsule'} disabled={query.offline} onPress={() => setCeremony({ id: capsule.id, together: capsule.open_together })} />}</Card>;
        })}</StaggerList>}
      {query.data && (tab === 'received' ? !query.data.received.length : !query.data.authored.length) && <EmptyState title={tab === 'received' ? 'Good things take their time' : 'Write to your future'} description={tab === 'received' ? 'Letters sealed for you will appear here.' : 'Save a message, a surprise, or a moment for your next anniversary.'} />}
    </ScrollView></Screen>;
}

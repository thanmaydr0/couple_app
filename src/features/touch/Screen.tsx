import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Orientation from 'expo-screen-orientation';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { usePartner, useProfile } from '@/lib/hooks';
import { useTheme } from '@/theme';
import { Burst, PulseRing, PressableScale, useMotion } from '@/motion';
import { Screen, Header, Text, Button, IconButton, ErrorState, Skeleton } from '@/ui';
import { duration } from './protocol';
import { invitePartner, useTouchRoom } from './useTouchRoom';
import { TouchCanvas } from './TouchCanvas';
import type { Intensity } from './types';

export default function TouchScreen() {
  const profile = useProfile(); const partner = usePartner(); const router = useRouter();
  const { colors, spacing, radius } = useTheme(); const motion = useMotion();
  const [open, setOpen] = useState(false); const [settings, setSettings] = useState(false);
  const [intensity, setIntensity] = useState<Intensity>('off'); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false); const [summary, setSummary] = useState<number>(); const [burst, setBurst] = useState(0);
  const [retry, setRetry] = useState(false);
  const room = useTouchRoom(profile.data?.couple_id ?? undefined, profile.data?.id, partner.data?.id, colors.primary, open && !retry, intensity, motion.level === 'full');
  function leave() { room.up(); setSummary(room.held); setBurst(n => n + 1); setOpen(false); }
  useEffect(() => {
    if (!open || !room.active || room.expired) return;
    let disposed = false; let previous: Orientation.OrientationLock | undefined;
    const setup = async () => {
      try { previous = await Orientation.getOrientationLockAsync(); if (disposed) return; await Orientation.lockAsync(Orientation.OrientationLock.PORTRAIT_UP); if (disposed && previous !== undefined) await Orientation.lockAsync(previous); }
      catch { if (!disposed) setNotice('Portrait lock unavailable. Touch positions still adapt to screen size.'); }
    };
    void setup(); void activateKeepAwakeAsync('touch-room').then(() => { if (disposed) void deactivateKeepAwake('touch-room'); }).catch(() => { if (!disposed) setNotice('Keep-awake unavailable on this device.'); });
    return () => { disposed = true; void deactivateKeepAwake('touch-room'); if (previous !== undefined) void Orientation.lockAsync(previous).catch(() => {}); };
  }, [open, room.active, room.expired]);
  useEffect(() => { if (!open) return; const sub = BackHandler.addEventListener('hardwareBackPress', () => { leave(); return true; }); return () => sub.remove(); }, [open, room.held]);
  useEffect(() => { if (!retry) return; const timer = setTimeout(() => setRetry(false), motion.duration('fast')); return () => clearTimeout(timer); }, [retry]);
  async function enter(invite: boolean) {
    if (!profile.data?.id || !partner.data) return;
    setSummary(undefined); setNotice(''); setOpen(true);
    if (invite) { setBusy(true); try { setNotice(await invitePartner(profile.data.id)); } finally { setBusy(false); } }
  }
  return <Screen bottomInset style={{ gap: spacing.md }}>
    <Header title="Touch Together" subtitle={open ? 'A little closer, from anywhere' : 'A hand to hold, wherever you are'} onBack={() => open ? leave() : router.back()} right={<IconButton name="settings-outline" accessibilityLabel="Touch settings" onPress={() => setSettings(v => !v)} />} />
    {settings && <View style={{ gap: spacing.sm }}>
      <Text variant="title/S">Haptic intensity</Text>
      <Text variant="body/S" color="textSecondary">Off by default. Heartbeats use your chosen intensity in Full animation mode.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{(['off', 'gentle', 'strong'] as const).map(value => <PressableScale key={value} haptic={false} accessibilityRole="button" accessibilityState={{ selected: value === intensity }} onPress={() => setIntensity(value)} style={{ padding: spacing.s12, borderRadius: radius.pill, backgroundColor: value === intensity ? colors.primary : colors.surfaceAlt }}><Text variant="label" color={value === intensity ? 'primaryContrast' : 'textPrimary'}>{value === intensity ? `${value} ✓` : value}</Text></PressableScale>)}</View>
    </View>}
    {notice ? <Text variant="body/S" color="textSecondary" accessibilityLiveRegion="polite">{notice}</Text> : null}
    {profile.isLoading || partner.isLoading ? <Skeleton /> : profile.isError || partner.isError ? <ErrorState title="Couldn’t load your couple" onRetry={() => { void profile.refetch(); void partner.refetch(); }} /> : !profile.data?.couple_id || !partner.data ? <Text>Pair with your partner before starting Touch Together.</Text> : open ? <>
      <Text variant="body/S" accessibilityLiveRegion="polite">{room.status}</Text>
      <Text variant="caption" color="textSecondary">Live touch sharing is on · nothing is saved · {intensity === 'off' ? 'haptics off' : `${intensity} haptics`}</Text>
      {room.expired ? <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}><Text variant="title/M">A little pause after 30 minutes</Text><Text>Your stream is paused to save battery and messages.</Text><Button title="Continue together" onPress={room.continueRoom} /><Button title="End session" variant="secondary" onPress={leave} /></View> : <TouchCanvas room={room} />}
      <Text variant="title/M" style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}>{room.merged ? `Touching for ${duration(room.held)}` : room.present ? 'Find each other. Hold a finger down.' : 'Waiting for them…'}</Text>
      <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>Double tap the canvas to send a heart.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}><Button title="Leave room" variant="secondary" onPress={leave} /><Button title="Reconnect" variant="ghost" onPress={() => { room.up(); setRetry(true); }} /></View>
    </> : <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg }}>
      <PulseRing><Text variant="title/L" color="primary">♡</Text></PulseRing>
      <Text variant="display/M" style={{ textAlign: 'center' }}>Meet in the middle.</Text>
      <Text color="textSecondary" style={{ textAlign: 'center' }}>Touch the same place on your screens. When your fingers meet, hold a moment together.</Text>
      <Button title="Invite them to Touch" loading={busy} onPress={() => { void enter(true); }} style={{ alignSelf: 'stretch', paddingVertical: spacing.lg }} />
      <Button title="Join without an invitation" variant="ghost" onPress={() => { void enter(false); }} />
      {summary !== undefined && <View style={{ gap: spacing.sm, alignItems: 'center' }}><Text variant="title/S">You held hands for {Math.floor(summary / 60_000)}m {Math.floor(summary / 1000) % 60}s</Text><View style={{ position: 'absolute' }}><Burst trigger={burst} /></View></View>}
      <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>Touch positions are shared only in this room while your partner is here. Leave any time.</Text>
    </ScrollView>}
  </Screen>;
}

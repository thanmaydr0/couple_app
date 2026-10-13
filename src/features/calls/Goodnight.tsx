import { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, TextInput, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { Button, Header, Screen, Text } from '@/ui';
import { themes, useTheme } from '@/theme';
import { useSession } from '@/lib/hooks';
import { getCallEngine, useCalls } from './engine';

const beds = { White: require('./ambient/white.wav'), Pink: require('./ambient/pink.wav'), Brown: require('./ambient/brown.wav'), Rain: require('./ambient/rain.wav') };
const FADE_MS = 30_000;
export function GoodnightScreen() {
  const { colors, spacing, geometry } = useTheme();
  const player = useAudioPlayer(null);
  const [resting, setResting] = useState(true);
  const [volume, setVolume] = useState(0.15);
  const [deadline, setDeadline] = useState<number>();
  const [both, setBoth] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string>();
  const finishing = useRef(false);
  const { asleep, partnerAsleep } = useCalls();
  const engine = getCallEngine();
  useEffect(() => {
    void setAudioModeAsync({ interruptionMode: 'mixWithOthers', shouldPlayInBackground: true }).catch(() => setError('Ambient background audio is unavailable.'));
    return () => { player.pause(); };
  }, [player]);
  useEffect(() => {
    player.loop = true;
    const update = () => {
      const time = Date.now(); setNow(time);
      player.volume = volume * (deadline ? Math.max(0, Math.min(1, (deadline - time) / FADE_MS)) : 1);
      if (deadline && time >= deadline && !finishing.current) { finishing.current = true; void getCallEngine()?.end(); }
    };
    update(); const timer = setInterval(update, 1000);
    const subscription = AppState.addEventListener('change', update);
    return () => { clearInterval(timer); subscription.remove(); };
  }, [deadline, volume, player]);
  useEffect(() => { if (both && asleep && partnerAsleep && !deadline) setDeadline(Date.now() + FADE_MS); }, [both, asleep, partnerAsleep, deadline]);
  if (resting) return <Screen bottomInset style={{ backgroundColor: colors.shadowColor }}>
    <View style={{ padding: spacing.sm, borderRadius: spacing.sm, backgroundColor: colors.surface }}><Header title="Goodnight" subtitle="Together, quietly" /></View>
    <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
      <Text variant="display/L" style={{ color: themes.Noir.textSecondary, textAlign: 'center' }}>{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      <Text style={{ color: themes.Noir.textSecondary, textAlign: 'center' }}>{deadline ? `Ends at ${new Date(deadline).toLocaleTimeString()}` : both ? 'Waiting for both asleep confirmations' : 'Goodnight'}</Text>
    </View>
    <Button title="Sound and sleep timer" variant="secondary" onPress={() => setResting(false)} />
    <Button title="End call" variant="secondary" onPress={() => { player.pause(); void engine?.end(); }} />
  </Screen>;
  return <Screen bottomInset><Header title="Goodnight" subtitle="A quiet moment together" />
    <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
      <Button title="Dim screen" variant="secondary" onPress={() => setResting(true)} />
      <Text variant="display/L">{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      <Text>Audio only · target 20 kbps · ambient audio stays on your phone</Text>
      <Text>{deadline ? `Call ends at ${new Date(deadline).toLocaleTimeString()}` : both ? 'Ends after you both tap “I’m asleep”' : 'No sleep timer set'}</Text>
      {error && <Text color="danger">{error}</Text>}
      <View style={{ gap: spacing.sm }}>{Object.entries(beds).map(([name, source]) => <Button key={name} title={`${name} noise`} variant="secondary" onPress={() => {
        try { player.replace(source); player.volume = volume; player.loop = true; player.play(); } catch { setError('Ambient playback could not start.'); }
      }} />)}</View>
      <Text>Ambient volume: {Math.round(volume * 100)}%</Text>
      <Slider accessibilityLabel="Ambient volume" minimumValue={0} maximumValue={0.5} value={volume} onValueChange={setVolume}
        minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary} style={{ minHeight: geometry.touch }} />
      <Button title="Stop ambient sound" variant="secondary" onPress={() => player.pause()} />
      {[30, 60, 120].map(minutes => <Button key={minutes} title={`End in ${minutes} minutes`} variant="secondary" onPress={() => { setBoth(false); setDeadline(Date.now() + minutes * 60_000); }} />)}
      <Button title="Until we’re both asleep" onPress={() => { setDeadline(undefined); setBoth(true); }} />
      <Button title={asleep ? 'You marked yourself asleep' : 'I’m asleep'} disabled={asleep} onPress={() => { void engine?.markAsleep().catch(() => setError('Could not tell your partner. Check your connection.')); }} />
      <Button title="End call" variant="danger" onPress={() => { player.pause(); void engine?.end(); }} />
    </ScrollView></Screen>;
}

export function BedtimeReminder() {
  const { spacing, colors, geometry, radius, typography } = useTheme();
  const { data: session } = useSession();
  const [time, setTime] = useState('22:00');
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const key = `calls-bedtime:${session?.user.id ?? 'signed-out'}`;
  const disable = async () => {
    const id = await AsyncStorage.getItem(key);
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(key);
  };
  return <View style={{ gap: spacing.sm }}><Text variant="title/S">Optional bedtime reminder</Text>
    <Text>Choose a nightly local “Goodnight call?” suggestion. Off until enabled.</Text>
    <TextInput accessibilityLabel="Bedtime in 24-hour HH:MM format" value={time} onChangeText={setTime} maxLength={5}
      style={{ color: colors.textPrimary, backgroundColor: colors.surface, ...typography['body/M'], minHeight: geometry.touch, padding: spacing.md, borderRadius: radius.md }} />
    <Button title="Enable nightly suggestion" loading={busy} onPress={() => {
      void (async () => {
        setBusy(true);
        try {
          if (!session || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Enter a time such as 22:00.');
          if (!(await Notifications.requestPermissionsAsync()).granted) throw new Error('Allow notifications to enable the reminder.');
          await disable();
          await Notifications.setNotificationChannelAsync('bedtime', { name: 'Bedtime suggestions', importance: Notifications.AndroidImportance.DEFAULT });
          const [hour, minute] = time.split(':').map(Number);
          const id = await Notifications.scheduleNotificationAsync({ content: { title: 'Goodnight call?', body: 'A quiet moment together before sleep.', data: { url: '/call' } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'bedtime' } });
          await AsyncStorage.setItem(key, id); setMessage(`Nightly suggestion enabled at ${time}.`);
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not schedule reminder.'); }
        finally { setBusy(false); }
      })();
    }} />
    <Button title="Disable nightly suggestion" variant="secondary" onPress={() => { void disable().then(() => setMessage('Nightly suggestion disabled.')).catch(() => setMessage('Could not disable reminder. Try again.')); }} />
    {message && <Text accessibilityLiveRegion="polite">{message}</Text>}
  </View>;
}

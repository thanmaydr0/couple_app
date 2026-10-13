import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, ScrollView, View } from 'react-native';
import { AndroidImportance, AndroidNotificationSetting, AuthorizationStatus } from 'react-native-notify-kit';
import { Screen, Header, Text, Button } from '@/ui';
import { useTheme } from '@/theme';
import Constants from 'expo-constants';
import { CALL_CHANNEL, ensureCallChannel, isRingingDispatcherReady, notify, openFullScreenSettings } from './runtime';

export function RingingHealthScreen({ onBack }: { onBack: () => void }) {
  const { spacing } = useTheme();
  const [checks, setChecks] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true); setError(undefined);
    try {
      await ensureCallChannel();
      const [settings, channel, battery, power] = await Promise.all([
        notify.getNotificationSettings(), notify.getChannel(CALL_CHANNEL), notify.isBatteryOptimizationEnabled(), notify.getPowerManagerInfo(),
      ]);
      setChecks([
        `Background call actions: ${isRingingDispatcherReady() ? 'dispatcher registered' : 'shared entry integration missing'}`,
        `Screen sharing native setup: ${Constants.expoConfig?.extra?.ringingMediaProjectionReady ? 'configured; device test required' : 'config plugin not registered'}`,
        `Notifications: ${settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED ? 'allowed' : 'blocked'}`,
        `Full-screen calls: ${settings.android.fullScreenIntent === AndroidNotificationSetting.ENABLED ? 'allowed' : 'not allowed or unavailable'}`,
        `Battery optimization: ${battery ? 'enabled — incoming calls may be delayed' : 'disabled'}`,
        `Call channel: ${channel && !channel.blocked && (channel.importance ?? AndroidImportance.DEFAULT) >= AndroidImportance.HIGH ? 'high importance' : 'blocked or below high importance'}`,
        `Lock-screen visibility: check “Show all notification content” in Android settings`,
        `Autostart: ${power.activity ? 'manufacturer settings available; inspect manually' : 'no manufacturer settings detected'}`,
      ]);
    } catch { setError('Could not read Android notification settings. Use an Android development or production build.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); }); return () => subscription.remove(); }, [refresh]);
  const open = (action: () => Promise<unknown>) => { void action().catch(() => setError('This settings screen is unavailable on this phone. Open Android Settings → Apps → Us.')); };
  return <Screen bottomInset><Header title="Ringing health check" onBack={onBack} />
    <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
      <Text>Android controls whether calls can wake your phone. Recheck after changing settings.</Text>
      {checks.map(check => <View key={check}><Text>{check}</Text></View>)}
      {error && <Text color="danger">{error}</Text>}
      <Button title="Recheck" loading={loading} onPress={() => { void refresh(); }} />
      <Button title="Allow notifications" onPress={() => open(() => notify.requestPermission().then(refresh))} />
      <Button title="Full-screen call permission" onPress={() => open(openFullScreenSettings)} />
      <Button title="Incoming call channel settings" onPress={() => open(() => notify.openNotificationSettings(CALL_CHANNEL))} />
      <Button title="Battery optimization settings" onPress={() => open(() => notify.openBatteryOptimizationSettings())} />
      <Button title="Phone autostart settings" onPress={() => open(() => notify.openPowerManagerSettings())} />
      <Button title="App and lock-screen settings" onPress={() => open(Linking.openSettings)} />
    </ScrollView></Screen>;
}

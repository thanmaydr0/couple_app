import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Button, Card, Header, ListItem, Screen, Switch, Text, ErrorState } from '@/ui';
import { useTheme } from '@/theme';
import { StaggerList } from '@/motion';
import { authenticate } from './authenticate';
import { setCaptureProtection } from './capture';
import { useLockStore } from './store';
import { usePrivacy } from './usePrivacy';
import { lockOptions, type LockDelay } from './types';

export function PrivacySettings() {
  const { spacing } = useTheme(); const lock = useLockStore(); const privacy = usePrivacy();
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const changeDelay = async (delay: LockDelay) => {
    if (busy || delay === lock.delay) return;
    setBusy(true); setNotice('');
    try {
      // Verify credentials before opting in or relaxing protection.
      await authenticate();
      if (delay !== 'off') await setCaptureProtection('us.applock', true);
      await lock.save(delay); setNotice('App lock saved on this device.');
    } catch (cause) {
      await setCaptureProtection('us.applock', lock.delay !== 'off').catch(() => {});
      setNotice(cause instanceof Error ? cause.message : 'Could not save app lock. Try again.');
    }
    finally { setBusy(false); }
  };
  const disabled = busy || privacy.save.isPending;
  return <StaggerList style={{ gap: spacing.lg }}>
    <Card style={{ gap: spacing.md }}><Text variant="title/M">App lock</Text>
      <Text color="textSecondary">App lock is {lock.delay === 'off' ? 'off' : 'on'}. When on, every cold start requires your device biometrics or PIN, pattern or password. Choose how soon it locks after leaving the app.</Text>
      <View accessibilityRole="radiogroup">{lockOptions.map(option => <ListItem key={option.value} title={option.label} trailing={<Text color={lock.delay === option.value ? 'primary' : 'textSecondary'}>{lock.delay === option.value ? 'Selected' : ''}</Text>} disabled={disabled || !lock.ready} onPress={() => { void changeDelay(option.value); }} />)}</View>
      {busy && <Text accessibilityRole="progressbar">Verifying and saving…</Text>}
      <Text variant="body/S" color="textSecondary">Hide in recents: {lock.delay === 'off' ? 'off' : 'on'}. With app lock on, Android blanks the app preview and blocks screenshots and recordings throughout the app. This protects previews before Android takes a background snapshot.</Text>
    </Card>
    <Card style={{ gap: spacing.md }}><Text variant="title/M">Private areas & notifications</Text>
      {privacy.isPending ? <Text>Loading privacy preferences…</Text> : privacy.isError ? <ErrorState description="Connect to load privacy preferences. App lock still works offline." onRetry={() => { void privacy.refetch(); }} /> : privacy.data ? <>
        {privacy.data.offline && <><Text color="textSecondary">Offline: showing the last saved preferences. Connect to save changes.</Text><Button title="Reconnect" variant="ghost" onPress={() => { void privacy.refetch(); }} /></>}
        <ListItem title="Hide message previews in notifications" subtitle="Ask the notification service to show a generic message instead of message text. Applies to notifications sent after saving." trailing={<Switch accessibilityLabel="Hide message previews in notifications" value={privacy.data.privacy.hide_message_previews} disabled={disabled || privacy.data.offline} onValueChange={enabled => privacy.save.mutate({ setting: 'hide_message_previews', enabled })} />} />
        <ListItem title="Block screenshots in private areas" subtitle="Blocks screenshots and recordings in screens connected to private-area protection. App lock also blocks captures throughout the app." trailing={<Switch accessibilityLabel="Block screenshots in private areas" value={privacy.data.privacy.block_screenshots} disabled={disabled || privacy.data.offline} onValueChange={enabled => privacy.save.mutate({ setting: 'block_screenshots', enabled })} />} />
      </> : <Text>Sign in to manage notification and private-area preferences.</Text>}
      {privacy.save.isPending && <Text accessibilityRole="progressbar">Saving privacy preferences…</Text>}
      {privacy.save.isError && <Text accessibilityRole="alert" color="danger">Could not save. Check your connection and try again. Your previous preference is unchanged.</Text>}
      {privacy.save.isSuccess && <Text accessibilityLiveRegion="polite" color="success">Privacy preference saved.</Text>}
    </Card>
    {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
  </StaggerList>;
}
export function SettingsSection() {
  return <Card><ListItem title="Privacy" subtitle="App lock, recents, screenshots and notification previews" onPress={() => router.push('/us/applock')} /></Card>;
}
export default function PrivacyScreen() {
  const { spacing } = useTheme();
  return <Screen bottomInset><Stack.Screen options={{ headerShown: false }} /><Header title="Privacy" onBack={() => router.back()} /><ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}><PrivacySettings /></ScrollView></Screen>;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';

const promptKey = 'push:permission-prompt:v1';
const savedTokenKey = (uid: string) => `push:registered-token:${uid}`;
let registration: Promise<boolean> | undefined;

export async function createChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Incoming calls', importance: Notifications.AndroidImportance.MAX, sound: 'default',
    enableVibrate: true, vibrationPattern: [0, 600, 500, 600],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  for (const id of ['pulse', 'plans', 'capsule', 'location']) {
    await Notifications.setNotificationChannelAsync(id, {
      name: id.charAt(0).toUpperCase() + id.slice(1),
      importance: Notifications.AndroidImportance.DEFAULT, sound: 'default',
    });
  }
}

function prePrompt(): Promise<boolean> {
  return new Promise((resolve) => Alert.alert('Stay close, even when you’re away',
    'Allow Us to let you know when your partner messages or calls. You can change this anytime in Android settings.', [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }));
}

// Serialize permission dialogs and token writes across startup, resume and Settings.
export function registerPush(uid: string, explicit = false): Promise<boolean> {
  if (registration) return registration.then(() => registerPush(uid, explicit));
  const task = (async () => {
    if (Platform.OS !== 'android' || !Device.isDevice || Constants.appOwnership === 'expo') return false;
    await createChannels(); // Android 13 requires a channel before requesting permission.
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain && (explicit || !await AsyncStorage.getItem(promptKey))) {
      await AsyncStorage.setItem(promptKey, 'shown');
      if (await prePrompt()) permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted) {
      // Stop routing notifications to a device whose permission was revoked.
      const { data } = await supabase.auth.getSession();
      const previousToken = await AsyncStorage.getItem(savedTokenKey(uid));
      if (data.session?.user.id === uid && previousToken) {
        await supabase.from('push_tokens').delete().eq('user_id', uid).eq('token', previousToken);
      }
      if (explicit && !permission.canAskAgain) Alert.alert('Notifications are off', 'Enable notifications for Us in Android settings.', [
        { text: 'Later', style: 'cancel' }, { text: 'Open settings', onPress: () => { void Linking.openSettings(); } },
      ]);
      return false;
    }
    const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (typeof projectId !== 'string' || !projectId) throw new Error('The EAS push project is not configured.');
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== uid) return false;
    const { error } = await supabase.from('push_tokens').upsert({
      user_id: uid, token: token.data, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw new Error('Could not save notification registration. Try again.');
    await AsyncStorage.setItem(savedTokenKey(uid), token.data);
    return true;
  })();
  registration = task;
  void task.finally(() => { if (registration === task) registration = undefined; }).catch(() => {});
  return task;
}

export async function unregisterPush(uid: string) {
  // Finish a pending registration before deletion so it cannot recreate the row.
  await registration?.catch(() => false);
  const token = await AsyncStorage.getItem(savedTokenKey(uid));
  if (!token) return;
  // Another phone may have replaced this user's single registration since login.
  const { error } = await supabase.from('push_tokens').delete().eq('user_id', uid).eq('token', token);
  if (error) throw new Error('Could not remove notification registration. Try signing out again.');
}

export async function testNotification(uid: string): Promise<string> {
  if (!await registerPush(uid, true)) return 'Allow notifications on a physical Android development or release build, then try again.';
  const { error } = await supabase.functions.invoke('notify-partner', { body: {
    type: 'test', title: 'Us notifications are ready', body: 'Your test notification arrived.', data: {},
  } });
  if (error) throw new Error('The remote test could not be sent. Check your connection and Expo FCM credentials.');
  return 'Remote test accepted by Expo. Confirm it appears on this phone; delivery is not guaranteed by acceptance.';
}

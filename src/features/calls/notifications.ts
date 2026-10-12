import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

export async function registerCallNotifications(uid: string, request = false) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Incoming calls', importance: Notifications.AndroidImportance.MAX,
    sound: 'default', vibrationPattern: [0, 600, 500, 600], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && request && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) {
    if (request) Alert.alert('Call notifications', 'Allow notifications to see incoming calls when Us is closed.', [
      { text: 'Later', style: 'cancel' }, { text: 'Open settings', onPress: () => { void Linking.openSettings(); } },
    ]);
    return;
  }
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectId !== 'string') throw new Error('Push project is not configured.');
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  // Do not save an old user's token if sign-out happened during registration.
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== uid) return;
  const { error } = await supabase.from('push_tokens').upsert({ user_id: uid, token: token.data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw new Error('Could not register call notifications.');
}

export async function requestBluetoothRouting() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) return;
  if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT)) return;
  await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, {
    title: 'Use your headset', message: 'Allow nearby device access to route call audio to your paired Bluetooth headset.',
    buttonPositive: 'Continue', buttonNegative: 'Not now',
  });
}

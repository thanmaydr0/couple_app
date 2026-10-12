import { PermissionsAndroid, Platform } from 'react-native';
import { registerPush } from '@/features/notifications/service';

// Compatibility for the call screen's existing notification setup button.
export const registerCallNotifications = registerPush;
export async function requestBluetoothRouting() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) return;
  if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT)) return;
  await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, {
    title: 'Use your headset', message: 'Allow nearby device access to route call audio to your paired Bluetooth headset.',
    buttonPositive: 'Continue', buttonNegative: 'Not now',
  });
}

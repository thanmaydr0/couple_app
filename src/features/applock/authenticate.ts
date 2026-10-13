import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, Platform } from 'react-native';

let inFlight = false;
export function authenticationInProgress() { return inFlight; }
export async function authenticate(): Promise<void> {
  if (Platform.OS !== 'android') throw new Error('App lock requires the Android app.');
  if (AppState.currentState !== 'active' || inFlight) throw new Error('Return to the app and try again.');
  inFlight = true;
  try {
    if (await LocalAuthentication.getEnrolledLevelAsync() === LocalAuthentication.SecurityLevel.NONE)
      throw new Error('Set a device PIN, pattern or password in Android Settings first.');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Us', promptDescription: 'Use biometrics or your device PIN, pattern or password.',
      disableDeviceFallback: false, requireConfirmation: true,
    });
    if (!result.success) throw new Error(result.error === 'lockout'
      ? 'Biometrics are temporarily locked. Try again with your device PIN or pattern.'
      : 'Your space is still locked. Tap Unlock to try again.');
  } finally { inFlight = false; }
}

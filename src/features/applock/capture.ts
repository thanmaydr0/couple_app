import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

// Serialize native calls: a late release must never clear a newer acquisition.
let queue: Promise<void> = Promise.resolve();
export function setCaptureProtection(key: string, enabled: boolean): Promise<void> {
  const operation = queue.then(async () => {
    if (Platform.OS !== 'android') {
      if (enabled) throw new Error('Screen protection requires Android.');
      return;
    }
    if (enabled) await ScreenCapture.preventScreenCaptureAsync(key);
    else await ScreenCapture.allowScreenCaptureAsync(key);
  });
  queue = operation.catch(() => {});
  return operation;
}

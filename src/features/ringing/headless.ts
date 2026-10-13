// Import before expo-router/entry. Shared NotifyKit dispatcher must call this
// handler for call events and the location handler for location events.
import { handleRingingEvent, markRingingDispatcherReady, notify, runCallService } from './runtime';
import type { Event, Notification } from 'react-native-notify-kit';
export { handleRingingEvent, runCallService };
export function installRingingHeadless(other: {
  onEvent: (event: Event) => Promise<void>;
  runService: (notification: Notification) => Promise<void>;
}) {
  markRingingDispatcherReady();
  notify.onBackgroundEvent(event => event.detail.notification?.data?.callId ? handleRingingEvent(event) : other.onEvent(event));
  notify.registerForegroundService(notification => notification.id === 'us-active-call' ? runCallService() : other.runService(notification));
}

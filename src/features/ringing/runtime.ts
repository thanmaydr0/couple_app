import { AppState, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notify, { AndroidCategory, AndroidImportance, AndroidVisibility, AndroidForegroundServiceType as FGS, EventType, type Event } from 'react-native-notify-kit';
import { supabase } from '@/lib/supabase';

const TASK = 'us-incoming-call-v1';
const ACCEPT = 'us-call-accept';
const ACTIVE = 'us-active-call';
export const CALL_CHANNEL = 'incoming-calls-v1';
type Invite = { callId: string; kind: 'audio' | 'video'; expiresAt: string; callerName: string; recipientId: string; coupleId: string };
let actions: { ready: () => boolean; end: () => Promise<void>; stopSharing: () => Promise<void>; accept: (id: string) => Promise<void> } | undefined;
let serviceOwned = false;
let sharedDispatcherReady = false;
export function markRingingDispatcherReady() { sharedDispatcherReady = true; }
export function isRingingDispatcherReady() { return sharedDispatcherReady; }
let releaseService: (() => void) | undefined;
export function bindCallActions(value: typeof actions) { actions = value; }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
export function parseInvite(value: unknown): Invite | null {
  if (!record(value) || typeof value.callId !== 'string' || !/^[\da-f-]{36}$/i.test(value.callId) ||
    !['audio', 'video'].includes(String(value.kind)) || typeof value.expiresAt !== 'string' ||
    typeof value.callerName !== 'string' || typeof value.recipientId !== 'string' || typeof value.coupleId !== 'string') return null;
  const remaining = Date.parse(value.expiresAt) - Date.now();
  return remaining > 0 && remaining <= 45_000 ? value as Invite : null;
}
export async function ensureCallChannel() {
  return notify.createChannel({ id: CALL_CHANNEL, name: 'Incoming calls', importance: AndroidImportance.HIGH,
    sound: 'default', vibration: true, vibrationPattern: [600, 500, 600, 500], visibility: AndroidVisibility.PUBLIC });
}
export async function dismissIncoming(id: string) { await notify.cancelNotification(`call-${id}`); }
export async function showIncoming(value: unknown) {
  const invite = parseInvite(value);
  if (!invite || Platform.OS !== 'android') return;
  if (AppState.currentState === 'active' && actions?.ready()) return; // In-app call UI owns foreground ringing.
  const { data: auth } = await supabase.auth.getSession();
  if (auth.session?.user.id !== invite.recipientId) return;
  const { data: row } = await supabase.from('calls').select('*').eq('id', invite.callId).eq('couple_id', invite.coupleId).eq('status', 'ringing').maybeSingle();
  if (!row || row.caller_id === auth.session.user.id || Date.parse(row.started_at) + 40_000 <= Date.now()) return;
  await ensureCallChannel();
  await notify.displayNotification({ id: `call-${invite.callId}`, title: `${invite.callerName} is calling`,
    body: invite.kind === 'video' ? 'Incoming video call' : 'Incoming voice call', data: invite,
    android: { channelId: CALL_CHANNEL, category: AndroidCategory.CALL, importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC, ongoing: true, loopSound: true,
      timeoutAfter: Math.max(1, Date.parse(invite.expiresAt) - Date.now()),
      pressAction: { id: 'open', launchActivity: 'default' }, fullScreenAction: { id: 'open', launchActivity: 'default' },
      actions: [{ title: 'Accept', pressAction: { id: 'accept', launchActivity: 'default' } },
        { title: 'Decline', pressAction: { id: 'decline' } }] } });
}
export async function handleRingingEvent({ type, detail }: Event) {
  const id = detail.notification?.data?.callId;
  if (typeof id !== 'string' || ![EventType.ACTION_PRESS, EventType.PRESS].includes(type)) return;
  const action = detail.pressAction?.id;
  if (action === 'hangup') { await actions?.end(); return; }
  if (action === 'stop-sharing') { await actions?.stopSharing(); return; }
  if (action === 'decline') {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId || detail.notification?.data?.recipientId !== userId) return;
    // RLS + immutable call id scope. The durable update notifies the caller via Postgres Changes.
    const { error } = await supabase.from('calls').update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', id).eq('couple_id', String(detail.notification?.data?.coupleId)).neq('caller_id', userId).eq('status', 'ringing');
    if (error) throw new Error('Decline could not sync.');
    await dismissIncoming(id);
  } else if (action === 'accept') {
    await AsyncStorage.setItem(ACCEPT, id);
    await dismissIncoming(id);
    await consumeAccept();
  }
}
export async function rememberAccept(id: string) { await AsyncStorage.setItem(ACCEPT, id); }
export async function consumeAccept() {
  const id = await AsyncStorage.getItem(ACCEPT);
  if (id && actions?.ready() && AppState.currentState === 'active') { await AsyncStorage.removeItem(ACCEPT); await actions.accept(id); }
}
if (Platform.OS === 'android') {
  if (!TaskManager.isTaskDefined(TASK)) TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data, error }) => {
    if (error || !data || 'actionIdentifier' in data) return;
    let payload: unknown = data.data;
    try { if (typeof data.data.dataString === 'string') payload = JSON.parse(data.data.dataString); } catch { return; }
    await showIncoming(payload);
  });
  void Notifications.registerTaskAsync(TASK).catch(() => console.warn('[ringing] Background task registration unavailable.'));
  // Wire handleRingingEvent through the shared background dispatcher.
  notify.onForegroundEvent(event => { void handleRingingEvent(event).catch(() => console.warn('[ringing] Notification action failed.')); });

}
export function runCallService() { return new Promise<void>(resolve => { releaseService = resolve; }); }
export async function startCallService(callId: string, video: boolean, sharing = false) {
  if (Platform.OS !== 'android') return;
  const displayed = await notify.getDisplayedNotifications();
  if (displayed.some(item => item.notification.android?.channelId === 'location-sharing')) throw new Error('Shared foreground service coordination is required while location sharing is active.');
  if (!sharedDispatcherReady) notify.registerForegroundService(runCallService);
  await notify.createChannel({ id: 'ongoing-calls-v1', name: 'Ongoing calls', importance: AndroidImportance.LOW });
  serviceOwned = true;
  await notify.displayNotification({ id: ACTIVE, title: 'On a call', body: sharing ? 'You’re sharing your screen' : 'Tap to return to your call', data: { callId },
    android: { channelId: 'ongoing-calls-v1', asForegroundService: true, ongoing: true, category: AndroidCategory.CALL,
      foregroundServiceTypes: [FGS.FOREGROUND_SERVICE_TYPE_MICROPHONE, ...(video ? [FGS.FOREGROUND_SERVICE_TYPE_CAMERA] : [])],
      pressAction: { id: 'open', launchActivity: 'default' }, actions: [
        ...(sharing ? [{ title: 'Stop sharing', pressAction: { id: 'stop-sharing' } }] : []),
        { title: 'Hang up', pressAction: { id: 'hangup' } }] } });
}
export async function stopCallService() {
  if (!serviceOwned) return;
  serviceOwned = false;
  releaseService?.(); releaseService = undefined;
  await notify.stopForegroundService(); await notify.cancelNotification(ACTIVE);
}
export async function openFullScreenSettings() {
  await Linking.openURL('intent:com.thanmay.teser#Intent;scheme=package;action=android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT;end')
    .catch(() => Linking.openSettings());
}
export { notify };

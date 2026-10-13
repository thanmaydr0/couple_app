import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { readState, refreshData, writeState } from './service';
const TASK = 'us-widget-data-push';
// Imported by the already registered widget handler at the JS entry point, before React mounts.
TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data, error }) => {
  if (error || !data) return;
  let payload: Record<string, unknown>;
  if ('actionIdentifier' in data) payload = data.notification.request.content.data ?? {};
  else {
    try { payload = data.data.dataString ? JSON.parse(data.data.dataString) as Record<string, unknown> : data.data; }
    catch { return; }
  }
  if (payload.widgetRefresh !== true) return;
  const state = await readState();
  if (!state.enabled || payload.recipientId !== state.owner || payload.coupleId !== state.couple) return;
  // Resolve the image through the stored Supabase session and RLS; never trust a push URL.
  const { renderAll } = await import('./widget-task-handler');
  await renderAll(await refreshData());
});
export async function registerWidgetPush() {
  try { await Notifications.registerTaskAsync(TASK); }
  catch {
    const state = await readState();
    await writeState({ ...state, error: 'Background push registration failed. App-open refresh remains available.' });
  }
}

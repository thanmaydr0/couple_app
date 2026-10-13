import * as Notifications from 'expo-notifications';
import type { FocusSession } from './types';
let queue: Promise<unknown> = Promise.resolve();
/** Serialize replacements; deterministic identifiers survive process restarts. */
export function syncNotifications(s: FocusSession | null, now: number, request = false): Promise<boolean> {
    const sampledAt = performance.now();
    const task = queue.catch(() => { }).then(async () => {
        const pending = await Notifications.getAllScheduledNotificationsAsync();
        await Promise.all(pending.filter(n => n.identifier.startsWith('focus:')).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
        if (!s || s.status !== 'active')
            return true;
        await Notifications.setNotificationChannelAsync('focus', { name: 'Focus phase reminders', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' });
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && request && permission.canAskAgain)
            permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted)
            return false;
        const start = Date.parse(s.started_at);
        for (let i = 0; i < s.cycles; i++) {
            const workEnd = start + ((i * (s.work_sec + s.break_sec)) + s.work_sec) * 1000;
            const boundaries = [{ at: workEnd, title: i === s.cycles - 1 ? 'Focus complete' : 'Time for a gentle break' }, ...(i < s.cycles - 1 ? [{ at: workEnd + s.break_sec * 1000, title: 'Time to focus together' }] : [])];
            for (const [j, b] of boundaries.entries()) {
                // Permission dialogs and queued replacements may take seconds.
                // Account for that delay rather than shifting every phase alert.
                const serverNow = now + performance.now() - sampledAt;
                if (b.at > serverNow) {
                    await Notifications.scheduleNotificationAsync({ identifier: `focus:${s.id}:${i}:${j}`, content: { title: b.title, body: 'Open your room to see your shared garden.', sound: 'default', data: { route: '/us/focus', session_id: s.id } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + b.at - serverNow), channelId: 'focus' } });
                }
            }
        }
        return true;
    });
    queue = task;
    return task;
}

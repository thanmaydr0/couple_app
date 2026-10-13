import * as Notifications from 'expo-notifications';
import type { Person, PlanEvent } from './types';
import { DAY, expand, fromWall, MINUTE, zoneOf } from './time';

let queue = Promise.resolve();
/** Diff only Plans notifications. Serialize resyncs to prevent duplicate schedules.
 * Keep the next 60 alarms over 90 days and replenish on changes/foreground. */
export function syncNotifications(events: PlanEvent[], people: Person[], enabled: boolean, deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  queue = queue.catch(() => undefined).then(async () => {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const ours = existing.filter(n => n.content.data?.feature === 'plans');
    if (!enabled || !(await Notifications.getPermissionsAsync()).granted) { await Promise.all(ours.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))); return; }
    await Notifications.setNotificationChannelAsync('plans', { name: 'Plans', importance: Notifications.AndroidImportance.HIGH });
    const now = Date.now(); const zone = deviceZone || zoneOf(people[0]);
    const reminders = expand(events.filter(e => e.status === 'confirmed'), people, now - DAY, now + 90 * DAY).flatMap(e => e.remind_minutes.map(minutes => {
      // All-day reminders happen relative to 09:00 on that same civil day on each phone.
      let start = Date.parse(e.starts_at);
      if (e.all_day) { try { start = fromWall(`${e.starts_at.slice(0, 10)}T09:00`, zone); } catch { return null; } }
      return { event: e, at: start - minutes * MINUTE, minutes };
    })).filter((r): r is NonNullable<typeof r> => r !== null && r.at > now).sort((a, b) => a.at - b.at).slice(0, 60);
    const wanted = new Set(reminders.map(r => `plans:${r.event.occurrence}:${r.minutes}`));
    await Promise.all(ours.filter(n => !wanted.has(n.identifier)).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    for (const { event, at, minutes } of reminders) {
      const identifier = `plans:${event.occurrence}:${minutes}`;
      const prior = ours.find(n => n.identifier === identifier);
      if (prior?.content.title === event.title && prior.content.data?.at === at) continue;
      if (prior) await Notifications.cancelScheduledNotificationAsync(identifier);
      await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title: event.title, body: event.all_day ? 'A special day is here.' : `Coming up in ${minutes} minutes.`, data: { feature: 'plans', route: '/us/plans', event_id: event.id, at }, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: 'plans' },
    }); }
  });
  return queue;
}

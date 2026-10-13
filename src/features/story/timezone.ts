import { z } from 'zod';
export function localDay(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part = (type: string) => parts.find(p=>p.type===type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
// Resolve a local calendar time, including offsets and DST, without assuming the
// phone's timezone is the couple's timezone.
export function wallTime(day: string, timezone: string, hour = 9) {
  const target = Date.parse(`${day}T${String(hour).padStart(2,'0')}:00:00Z`); let result = target;
  for (let attempt=0;attempt<4;attempt++) {
    const date = new Date(result);
    const time = new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date);
    result += target-Date.parse(`${localDay(date,timezone)}T${time}Z`);
  }
  return new Date(result);
}
export function storyTimezone(couple: unknown) {
  const parsed = z.object({ timezone: z.string().nullable().optional() }).safeParse(couple);
  const zone = parsed.success ? parsed.data.timezone : undefined;
  if (zone) { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return zone; } catch {} }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

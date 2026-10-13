import type { Availability, Occurrence, Person, PlanEvent, Window } from './types';
export const MINUTE = 60_000;
export const DAY = 1440 * MINUTE;
export const validZone = (zone: string): boolean => { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; } catch { return false; } };
export function zoneOf(person?: Person | null) { return person?.timezone && validZone(person.timezone) ? person.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone; }
export function wall(instant: number | string, zone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  const p = (name: string) => parts.find(part => part.type === name)?.value ?? '';
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`;
}
/** Reject gaps and folds rather than silently choosing an offset. */
export function fromWall(value: string, zone: string): number {
  if (!validZone(zone) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Use YYYY-MM-DDTHH:mm and a valid IANA timezone.');
  const naive = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 16) !== value) throw new Error('Invalid calendar date.');
  const matches: number[] = [];
  for (let offset = -840; offset <= 840; offset += 15) { const t = naive + offset * MINUTE; if (wall(t, zone) === value) matches.push(t); }
  if (matches.length !== 1) throw new Error('Daylight saving skips or repeats this time. Choose another time.');
  return matches[0]!;
}
export function rangeLabel(window: Window, zone: string) {
  const f = new Intl.DateTimeFormat('en', { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `${f.format(window.start)} – ${f.format(window.end)}`;
}
/** Scan actual UTC minutes: spring gaps never exist; autumn folds occur twice. */
export function findWindows(rows: Availability[], you: Person, them: Person, now = Date.now()): Window[] {
  const people = [you, them];
  const formatters = people.map(person => new Intl.DateTimeFormat('en', { timeZone: zoneOf(person), weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const free = (time: number, index: number) => {
    const parts = formatters[index]!.formatToParts(time); const p = (name: string) => parts.find(part => part.type === name)?.value ?? '';
    const weekday = weekdays.indexOf(p('weekday')); const minute = Number(p('hour')) * 60 + Number(p('minute'));
    return rows.some(row => row.user_id === people[index]!.id && row.weekday === weekday && minute >= row.start_minute && minute < row.end_minute);
  };
  const results: Window[] = []; let start: number | null = null;
  const first = Math.ceil(now / MINUTE) * MINUTE; const limit = first + 35 * DAY;
  for (let t = first; t <= limit; t += MINUTE) {
    const available = t < limit && free(t, 0) && free(t, 1);
    if (available && start === null) start = t;
    if (!available && start !== null) { if (t - start >= 30 * MINUTE) results.push({ start, end: t }); start = null; if (results.length === 5) break; }
  }
  return results;
}
export function expand(events: PlanEvent[], people: Person[], from: number, until: number): Occurrence[] {
  const result: Occurrence[] = [];
  for (const event of events) {
    if (event.status === 'declined') continue;
    const zone = event.all_day ? 'UTC' : zoneOf(people.find(p => p.id === event.created_by));
    const base = wall(event.starts_at, zone); const date = new Date(`${base}:00Z`); const duration = Date.parse(event.ends_at) - Date.parse(event.starts_at);
    for (let n = 0; n < 12000; n++) {
      const d = new Date(date);
      if (event.repeat === 'weekly') d.setUTCDate(date.getUTCDate() + n * 7);
      if (event.repeat === 'monthly') { d.setUTCDate(1); d.setUTCMonth(date.getUTCMonth() + n); d.setUTCDate(Math.min(date.getUTCDate(), new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate())); }
      if (event.repeat === 'yearly') { d.setUTCDate(1); d.setUTCFullYear(date.getUTCFullYear() + n); d.setUTCDate(Math.min(date.getUTCDate(), new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate())); }
      let start: number;
      try { start = n === 0 ? Date.parse(event.starts_at) : fromWall(d.toISOString().slice(0, 16), zone); } catch { if (d.getTime() > until + DAY) break; continue; }
      if (start > until + DAY) break;
      if (start + duration > from && start <= until) result.push({ ...event, starts_at: new Date(start).toISOString(), ends_at: new Date(start + duration).toISOString(), occurrence: `${event.id}:${start}` });
      if (event.repeat === 'none') break;
    }
  }
  return result.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
export function generated(coupleId: string, anniversary: string | null, people: Person[], from: number, until: number): Occurrence[] {
  const seeds: PlanEvent[] = [];
  const add = (title: string, date: string, kind: PlanEvent['kind'], repeat: PlanEvent['repeat']) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const start = Date.parse(`${date}T00:00:00Z`); if (!Number.isFinite(start)) return;
    seeds.push({ id: `auto:${title}`, couple_id: coupleId, title, starts_at: new Date(start).toISOString(), ends_at: new Date(start + DAY).toISOString(), all_day: true, location: null, notes: null, kind, repeat, status: 'confirmed', proposed_by: null, remind_minutes: [], created_by: '', created_at: new Date(start).toISOString() });
  };
  if (anniversary && Number.isFinite(Date.parse(anniversary))) { add('Our anniversary', anniversary, 'anniversary', 'yearly'); for (const n of [100, 365, 1000]) add(`Day ${n} together`, new Date(Date.parse(`${anniversary}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10), 'anniversary', 'none'); }
  people.forEach(p => { if (p.birthday) add(`${p.display_name ?? 'Your partner'}’s birthday`, p.birthday, 'birthday', 'yearly'); });
  return expand(seeds, [], from, until).map(e => ({ ...e, readonly: true }));
}
export function dayKey(event: Pick<PlanEvent, 'all_day' | 'starts_at'>, zone: string) { return event.all_day ? event.starts_at.slice(0, 10) : wall(event.starts_at, zone).slice(0, 10); }
export function occursOnDay(event: PlanEvent, key: string, zone: string) {
  const end = event.all_day ? new Date(Date.parse(event.ends_at) - 1).toISOString().slice(0, 10) : wall(Date.parse(event.ends_at) - 1, zone).slice(0, 10);
  return dayKey(event, zone) <= key && end >= key;
}

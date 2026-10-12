import { useCouple } from './hooks';

export const defaultCoupleTimezone = 'Asia/Kolkata';
export function validTimezone(value: string): boolean { try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; } }
export function deviceTimezone(): string { const zone = Intl.DateTimeFormat().resolvedOptions().timeZone; return validTimezone(zone) ? zone : defaultCoupleTimezone; }
export function coupleTimezone(couple: unknown): string {
  const zone = couple && typeof couple === 'object' && 'timezone' in couple ? couple.timezone : null;
  return typeof zone === 'string' && validTimezone(zone) ? zone : defaultCoupleTimezone;
}
export function useCoupleTimezone() { const couple = useCouple(); return { ...couple, timezone: coupleTimezone(couple.data) }; }
export function todayKey(timeZone: string, instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const part = (name: string) => parts.find(value => value.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
/** One instant, two wall clocks. Persist UTC instants, never localized strings. */
export function partnerTimes(instant: Date | string, yourTimezone: string, partnerTimezone: string) {
  const date = new Date(instant);
  const format = (timeZone: string) => new Intl.DateTimeFormat('en', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(date);
  return { yours: format(yourTimezone), partner: format(partnerTimezone), instant: date.toISOString() };
}
/** Convert a wall-clock input to UTC. Reject skipped or ambiguous DST times;
 * callers must ask for an unambiguous time instead of guessing an offset. */
export function zonedTimeToUtc(local: string, timeZone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !validTimezone(timeZone)) throw new Error('Invalid local time or timezone');
  const naive = new Date(`${local}:00Z`);
  if (!Number.isFinite(naive.getTime()) || naive.toISOString().slice(0, 16) !== local) throw new Error('Invalid date');
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const matches: Date[] = [];
  // IANA offsets in modern dates are multiples of 15 minutes, within ±14h.
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = new Date(naive.getTime() + offset * 60_000); const parts = formatter.formatToParts(candidate);
    const part = (name: string) => parts.find(value => value.type === name)?.value;
    if (`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}` === local) matches.push(candidate);
  }
  if (matches.length !== 1 || !matches[0]) throw new Error('This time is skipped or repeated by daylight saving. Choose another time.');
  return matches[0];
}

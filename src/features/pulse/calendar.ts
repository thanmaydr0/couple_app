import { questions } from './questions';
export function questionFor(day: string): string {
  const ordinal = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  return questions[((ordinal % questions.length) + questions.length) % questions.length]!;
}
export function streak(days: readonly string[], today: string): number {
  const set = new Set(days); let cursor = Date.parse(`${today}T00:00:00Z`); let count = 0;
  if (!set.has(today)) cursor -= 86_400_000;
  while (set.has(new Date(cursor).toISOString().slice(0, 10))) { count++; cursor -= 86_400_000; }
  return count;
}

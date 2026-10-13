export type LockDelay = 'off' | 'immediately' | '30s' | '1m' | '5m';
export type Privacy = { hide_message_previews: boolean; block_screenshots: boolean };
export const lockOptions: readonly { value: LockDelay; label: string }[] = [
  { value: 'off', label: 'Off' }, { value: 'immediately', label: 'Immediately' },
  { value: '30s', label: 'After 30 seconds' }, { value: '1m', label: 'After 1 minute' },
  { value: '5m', label: 'After 5 minutes' },
];
// Security policy intervals, independent of animation durations.
export const lockDelayMs: Record<LockDelay, number> = { off: Infinity, immediately: 0, '30s': 30_000, '1m': 60_000, '5m': 300_000 };
export function parseDelay(value: string | null): LockDelay {
  if (value === null) return 'off';
  if (lockOptions.some(option => option.value === value)) return value as LockDelay;
  throw new Error('The saved lock setting could not be read.');
}
export function requiresUnlock(delay: LockDelay, backgroundAt: number | null, now: number): boolean {
  return delay !== 'off' && (backgroundAt === null || now - backgroundAt >= lockDelayMs[delay]);
}

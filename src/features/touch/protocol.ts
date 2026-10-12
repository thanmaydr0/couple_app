import type { Message, Point, Touch } from './types';
// Network limits are protocol constants, separate from presentation motion tokens.
export const LIMITS = { sendMs: Math.ceil(1000 / 15), capMs: 30 * 60_000, inviteMs: 60_000, staleMs: 6000, clockMs: 2000, pulseMs: 1000, leadMs: 350, threshold: 0.085, extrapolateMs: 100 } as const;
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function together(a: Touch, b: Touch) { return a.down && b.down && distance(a, b) <= LIMITS.threshold; }
export function predict(previous: Touch, latest: Touch, now: number): Point {
  const dt = latest.at - previous.at;
  const ahead = Math.max(0, Math.min(LIMITS.extrapolateMs, now - latest.at));
  if (!latest.down || !previous.down || dt <= 0) return latest;
  return { x: clamp(latest.x + (latest.x - previous.x) / dt * ahead), y: clamp(latest.y + (latest.y - previous.y) / dt * ahead) };
}
export function decode(value: unknown): Message | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  if (typeof v.user !== 'string' || typeof v.instance !== 'string' || !finite(v.seq) || v.seq < 0 || !finite(v.at)) return null;
  if (v.kind === 'touch' || v.kind === 'heart') {
    if (!v.point || typeof v.point !== 'object') return null;
    const p = v.point as Record<string, unknown>;
    if (!finite(p.x) || !finite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 || (v.kind === 'touch' && v.down !== true)) return null;
  } else if (v.kind === 'ping') { if (!finite(v.sent)) return null; }
  else if (v.kind === 'pong') { if (!finite(v.sent) || !finite(v.received)) return null; }
  else if (v.kind === 'pulse') { if (!finite(v.when)) return null; }
  else if (v.kind !== 'up' && v.kind !== 'ready') return null;
  return value as Message;
}
export function duration(ms: number) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

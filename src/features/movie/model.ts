export type MovieFile = { uri: string; name: string; size: number; durationMs: number };
export const reactions = ['❤️', '😂', '😮', '🥹', '👏'] as const;
export function matches(file: MovieFile, expected: { file_size: number | null; duration_ms: number | null }) {
  return file.size === expected.file_size && expected.duration_ms !== null && Math.abs(file.durationMs - expected.duration_ms) <= 1000;
}
export function time(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 3600) ? `${Math.floor(value / 3600)}:` : ''}${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function driftCorrection(drift: number): { seek: boolean; rate: number } {
  return { seek: Math.abs(drift) > 0.6, rate: Math.abs(drift) <= 0.2 ? 1 : drift > 0 ? 1.03 : 0.97 };
}
export type Stamp = { counter: number; actor: string };
export function compare(a: Stamp, b: Stamp) { return a.counter - b.counter || a.actor.localeCompare(b.actor); }
export type EventName = 'play' | 'pause' | 'seek' | 'ready' | 'heartbeat' | 'end' | 'ping' | 'pong' | 'reaction' | 'leave';
export type Packet = {
  sender: string; client: string; seq: number; sentAt: number; pos: number;
  playing: boolean; ready: boolean; stamp: Stamp; resume: boolean;
  pingId?: string; t0?: number; t1?: number; t2?: number; emoji?: string;
};
export function packet(value: unknown): value is Packet {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<Packet>;
  return typeof p.sender === 'string' && typeof p.client === 'string' &&
    Number.isSafeInteger(p.seq) && typeof p.sentAt === 'number' && Number.isFinite(p.sentAt) &&
    typeof p.pos === 'number' && Number.isFinite(p.pos) && p.pos >= 0 &&
    typeof p.playing === 'boolean' && typeof p.ready === 'boolean' && typeof p.resume === 'boolean' &&
    !!p.stamp && Number.isSafeInteger(p.stamp.counter) && typeof p.stamp.actor === 'string';
}

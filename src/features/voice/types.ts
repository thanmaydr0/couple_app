export type VoiceMeta = { duration_ms: number; peaks: number[]; played_at?: string };
export type VoiceRecording = { uri: string; meta: VoiceMeta };
export function isVoiceMeta(value: unknown): value is VoiceMeta {
  if (!value || typeof value !== 'object') return false;
  const meta = value as Record<string, unknown>;
  return typeof meta.duration_ms === 'number' && Number.isFinite(meta.duration_ms) && meta.duration_ms >= 400 && meta.duration_ms <= 300_000
    && Array.isArray(meta.peaks) && meta.peaks.length === 64 && meta.peaks.every((peak: unknown) => typeof peak === 'number' && Number.isFinite(peak) && peak >= 0 && peak <= 1)
    && (meta.played_at === undefined || typeof meta.played_at === 'string' && Number.isFinite(Date.parse(meta.played_at)));
}
export const voiceLimits = { maxMs: 300_000, maxBytes: 3 * 1024 * 1024, sampleMs: 100, bars: 64, minMs: 400 };
export function voicePeaks(samples: readonly number[]): number[] {
  return Array.from({ length: voiceLimits.bars }, (_, i) => {
    const start = Math.floor(i * samples.length / voiceLimits.bars);
    const end = Math.max(start + 1, Math.floor((i + 1) * samples.length / voiceLimits.bars));
    return Math.min(1, Math.max(0, ...samples.slice(start, end)));
  });
}
export function voiceTime(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

import source from '../theme/tokens.json';
export const motionTokens = { ...source.motion, theme: 300, shimmer: 1600, pulse: 1200, heartbeat: 900, particles: 900, drift: 12000, toast: 3500, count: 600, travel: 8 } as const;
export type DurationName = 'instant' | 'fast' | 'base' | 'slow' | 'hero' | 'theme' | 'shimmer' | 'pulse' | 'heartbeat' | 'particles' | 'drift' | 'count';
export type SpringName = keyof typeof motionTokens.springs;

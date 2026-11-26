import source from '../theme/tokens.json';

export const motionTokens = {
  ...source.motion,
  theme: 320,
  shimmer: 1600,
  pulse: 1400,
  heartbeat: 1000,
  particles: 900,
  drift: 12000,
  toast: 3500,
  count: 650,
  travel: 16,
  pressScale: 0.965,
  springs: {
    gentle: { damping: 22, stiffness: 190, mass: 1 },
    snappy: { damping: 20, stiffness: 360, mass: 0.75 },
    bouncy: { damping: 13, stiffness: 250, mass: 0.85 },
    liquid: { damping: 26, stiffness: 170, mass: 1.2 },
    heavy: { damping: 30, stiffness: 120, mass: 1.6 },
  },
} as const;

export type DurationName =
  | 'instant'
  | 'fast'
  | 'base'
  | 'slow'
  | 'hero'
  | 'theme'
  | 'shimmer'
  | 'pulse'
  | 'heartbeat'
  | 'particles'
  | 'drift'
  | 'count';
export type SpringName = keyof typeof motionTokens.springs;

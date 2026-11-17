import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { useThemeStore, type AnimationLevel } from '../theme/store';
import { motionTokens, type DurationName, type SpringName } from './tokens';

let reduced = false;
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;
const listeners = new Set<() => void>();
function updateReduced(value: boolean) { reduced = value; listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!subscription) {
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', updateReduced);
    void AccessibilityInfo.isReduceMotionEnabled().then(val => updateReduced(Boolean(val))).catch(() => {});
  }
  return () => { listeners.delete(listener); if (!listeners.size) { subscription?.remove(); subscription = undefined; } };
}

export function useMotion() {
  const preference = useThemeStore(s => s.animationLevel);
  const systemReduced = useSyncExternalStore(subscribe, () => reduced, () => false);
  const level: AnimationLevel = preference === 'off' ? 'off' : preference === 'reduced' ? 'reduced' : systemReduced ? 'reduced' : 'full';
  return {
    level, preference, systemReduced,
    duration: (name: DurationName) => { 'worklet'; return level === 'off' ? 0 : level === 'reduced' ? Math.min(motionTokens[name], motionTokens.fast) : motionTokens[name]; },
    // Consumers use timing fades for reduced; never pass this to spatial motion below full.
    spring: (name: SpringName) => { 'worklet'; return level === 'full' ? { ...motionTokens.springs[name], reduceMotion: ReduceMotion.System } : { duration: 0, dampingRatio: 1, reduceMotion: ReduceMotion.Always }; },
  };
}

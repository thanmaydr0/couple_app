import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';
import { useMotion, motionTokens } from '@/motion';

type Pattern = 'heartbeat' | 'bloom' | 'tick';
let running = false;
export async function hapticPattern(pattern: Pattern, enabled = false): Promise<void> {
  if (!enabled || running || AppState.currentState !== 'active') return;
  running = true;
  try {
    if (pattern === 'tick') await Haptics.selectionAsync();
    else if (pattern === 'bloom') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise<void>(resolve => setTimeout(resolve, motionTokens.fast));
      if (AppState.currentState === 'active') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch { /* Haptics are optional; never fail an action. */ } finally { running = false; }
}
export const heartbeat = (enabled = false) => hapticPattern('heartbeat', enabled);
export const bloom = (enabled = false) => hapticPattern('bloom', enabled);
export const tick = (enabled = false) => hapticPattern('tick', enabled);
export function useHapticPatterns() { const motion = useMotion(); return { heartbeat: () => heartbeat(motion.level === 'full'), bloom: () => bloom(motion.level === 'full'), tick: () => tick(motion.level === 'full') }; }

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { PressableScale, HeartbeatView, useMotion, motionTokens } from '@/motion';
import { Text } from '@/ui';
import { heartbeat } from '@/lib/haptic-patterns';
import { sendHeartbeat } from './heartbeat';
import { limits } from './service';

export function HeartButton({ disabled = false }: { disabled?: boolean }) {
  const { spacing, radius, colors, geometry } = useTheme(); const motion = useMotion(); const [holding, setHolding] = useState(false); const [message, setMessage] = useState('Tap a heartbeat · hold to stay close');
  const held = useRef(false); const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const growth = useSharedValue(1);
  useEffect(() => { growth.value = withTiming(holding && motion.level === 'full' ? 1 + geometry.parallax : 1, { duration: motion.duration('slow') }); }, [holding, motion.level, geometry.parallax, growth]);
  const grown = useAnimatedStyle(() => ({ transform: [{ scale: growth.value }] }));
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = undefined; setHolding(false); };
  useEffect(() => { const sub = AppState.addEventListener('change', s => { if (s !== 'active') stop(); }); return () => { if (timer.current) clearInterval(timer.current); sub.remove(); }; }, []);
  useEffect(() => { if (disabled) stop(); }, [disabled]);
  const send = (sustained: boolean, continuation = false) => { void heartbeat(motion.level === 'full'); void sendHeartbeat(sustained, continuation).then(result => { if (result !== 'throttled') setMessage(result === 'live' ? 'A heartbeat sent to them ♥' : 'Thinking of you saved · push limited to every 10 minutes'); }).catch(() => { stop(); setMessage('Could not send heartbeat. Check your connection and try again.'); }); };
  return <><PressableScale haptic={false} disabled={disabled} accessibilityRole="button" accessibilityLabel="Send a heartbeat. Hold for a sustained heartbeat." delayLongPress={motionTokens.slow} onPressIn={() => { held.current = false; }} onLongPress={() => { held.current = true; setHolding(true); send(true); timer.current = setInterval(() => send(true, true), limits.heartbeatMs); }} onPressOut={stop} onPress={() => { if (!held.current) send(false); }} style={{ padding: spacing.lg, alignItems: 'center', borderRadius: radius.sheet, backgroundColor: colors.surfaceAlt, minHeight: geometry.touch * 2 }}><Animated.View style={grown}><HeartbeatView><Text variant="display/L" color="primary">♥</Text></HeartbeatView></Animated.View></PressableScale><Text variant="body/S" color="textSecondary" accessibilityLiveRegion="polite">{message}</Text></>;
}

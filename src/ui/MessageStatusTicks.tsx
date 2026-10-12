import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { cancelAnimation, interpolateColor, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { useMotion } from '../motion/useMotion';
export type MessageStatus = 'sending' | 'sent' | 'seen' | 'failed';
const AnimatedPath = Animated.createAnimatedComponent(Path);
const labels: Record<MessageStatus, string> = { sending: 'Sending', sent: 'Sent', seen: 'Seen', failed: 'Failed to send' };
export function MessageStatusTicks({ status, size }: { status: MessageStatus; size?: number }) {
  const { colors, geometry } = useTheme(); const motion = useMotion(); const seen = useSharedValue(status === 'seen' ? 1 : 0); const pulse = useSharedValue(1);
  useEffect(() => { seen.value = withTiming(status === 'seen' ? 1 : 0, { duration: motion.duration('base') }); }, [status, motion.level, seen]);
  useEffect(() => { cancelAnimation(pulse); pulse.value = 1; if (status === 'sending' && motion.level === 'full') pulse.value = withRepeat(withTiming(0.4, { duration: motion.duration('pulse') }), -1, true); return () => cancelAnimation(pulse); }, [status, motion.level, pulse]);
  const first = useAnimatedProps(() => ({ stroke: interpolateColor(seen.value, [0, 1], [colors.tickSent, colors.tickSeen]) }));
  const second = useAnimatedProps(() => ({ stroke: interpolateColor(seen.value, [0, 1], [colors.tickSent, colors.tickSeen]), strokeDashoffset: geometry.receiptLength * (1 - seen.value) }));
  const clock = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <View accessible accessibilityLabel={labels[status]} accessibilityLiveRegion="polite" style={{ width: size ?? geometry.receipt, height: size ?? geometry.receipt }}><Animated.View importantForAccessibility="no-hide-descendants" style={status === 'sending' ? clock : undefined}><Svg width={size ?? geometry.receipt} height={size ?? geometry.receipt} viewBox="0 0 24 24" fill="none" strokeWidth={geometry.stroke} strokeLinecap="round" strokeLinejoin="round">
    {status === 'sending' ? <><Circle cx="12" cy="12" r="8" stroke={colors.tickSent} /><Path d="M12 7v5l3 2" stroke={colors.tickSent} /></> : status === 'failed' ? <><Circle cx="12" cy="12" r="8" stroke={colors.danger} /><Path d="M12 7v6m0 4h.01" stroke={colors.danger} /></> : <><AnimatedPath d="m3 12 4 4 10-10" animatedProps={first} />{status === 'seen' && <AnimatedPath d="m10 16 11-10" strokeDasharray={`${geometry.receiptLength} ${geometry.receiptLength}`} animatedProps={second} />}</>}
  </Svg></Animated.View></View>;
}

import { useEffect, type ReactNode } from 'react';
import type { Color, PieceSymbol } from 'chess.js';
import { View, type ViewProps } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { Text } from '@/ui';
import { motionTokens, useMotion } from '@/motion';
import { useTheme } from '@/theme';
import { Piece } from './Piece';
export function PopView({ children, delay = 0, shrink = false, ...props }: ViewProps & { children?: ReactNode; delay?: number; shrink?: boolean }) {
  const motion = useMotion(); const scale = useSharedValue(1); const opacity = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(scale); cancelAnimation(opacity);
    scale.value = motion.level === 'full' ? shrink ? 1.3 : 0 : 1;
    opacity.value = motion.level === 'off' ? 1 : 0;
    if (motion.level === 'full') scale.value = withDelay(delay, withSpring(1, motion.spring('gentle')));
    opacity.value = withDelay(motion.level === 'full' ? delay : 0, withTiming(1, { duration: motion.duration('base') }));
    return () => { cancelAnimation(scale); cancelAnimation(opacity); };
  }, [motion.level, delay, shrink, scale, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return <Animated.View {...props} style={[props.style, style]}>{children}</Animated.View>;
}
export function CaptureTray({ label, pieces, color }: { label: string; pieces: PieceSymbol[]; color: Color }) {
  const { spacing, geometry } = useTheme();
  return <View style={{ gap: spacing.xs }}><Text variant="caption" color="textSecondary">{label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{pieces.length ? pieces.map((piece, index) => <PopView shrink key={`${piece}-${index}`} delay={index < geometry.firstScreenful ? index * motionTokens.stagger : 0}><Piece type={piece} color={color} size={geometry.icon} /></PopView>) : <Text variant="caption" color="textSecondary">No captures yet</Text>}</View></View>;
}

import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { FadeInView, StaggerList, motionTokens, useMotion } from '@/motion';
import { Text, Button } from '@/ui';
import { useTheme } from '@/theme';

export function Countdown({ remaining }: { remaining: number }) {
  const { colors, geometry, spacing, typography } = useTheme();
  const diameter = spacing.s56; const radius = (diameter - geometry.stroke * 2) / 2; const circumference = Math.PI * radius * 2;
  const motion = useMotion(); const pulse = useSharedValue(1);
  const urgent = remaining <= 10 && remaining > 0;
  useEffect(() => { cancelAnimation(pulse); pulse.value = 1; if (urgent && motion.level === 'full') pulse.value = withRepeat(withTiming(0.6, { duration: motion.duration('pulse') }), -1, true); return () => cancelAnimation(pulse); }, [urgent, motion.level, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const ink = remaining <= 5 ? colors.danger : remaining <= 10 ? colors.warning : colors.primary;
  // The countdown stays outside the drawing surface and never subscribes to strokes.
  return <View accessible accessibilityRole="timer" accessibilityLabel={`${Math.ceil(remaining)} seconds remaining${remaining <= 10 ? ', time running out' : ''}`} style={{ width: diameter, height: diameter, justifyContent: 'center', alignItems: 'center' }}>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, pulseStyle]}><Svg width={diameter} height={diameter}><Circle cx={diameter / 2} cy={diameter / 2} r={radius} stroke={colors.border} strokeWidth={geometry.stroke} fill="none" /><Circle cx={diameter / 2} cy={diameter / 2} r={radius} stroke={ink} strokeWidth={geometry.stroke} fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, remaining / 80)))} rotation={-90} origin={`${diameter / 2}, ${diameter / 2}`} strokeLinecap="round" /></Svg></Animated.View>
    <Text style={{ ...typography.label, color: ink }}>{Math.ceil(remaining)}</Text><Text variant="caption" color="textSecondary">sec</Text>
  </View>;
}
function Letter({ letter, index }: { letter: string; index: number }) {
  const motion = useMotion(); const flip = useSharedValue(0);
  useEffect(() => { flip.value = letter === '_' || motion.level !== 'full' ? 0 : 90; flip.value = motion.level === 'full' ? withSpring(0, motion.spring('gentle')) : 0; }, [letter, motion.level, flip]);
  const style = useAnimatedStyle(() => ({ transform: [{ perspective: motionTokens.particles }, { rotateX: `${flip.value}deg` }] }));
  return <Animated.View style={style}><FadeInView delay={index * motionTokens.stagger}><Text variant="title/M">{letter}</Text></FadeInView></Animated.View>;
}
export function WordHints({ mask }: { mask: string }) {
  const { spacing } = useTheme();
  return <View accessibilityLabel={mask} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{[...mask].map((letter, index) => <Letter key={index} letter={letter} index={index} />)}</View>;
}
export function FeedbackShake({ feedback, children }: { feedback: string; children: ReactNode }) {
  const { spacing } = useTheme(); const motion = useMotion(); const x = useSharedValue(0);
  useEffect(() => { cancelAnimation(x); x.value = 0; if (feedback && motion.level === 'full') x.value = withSequence(withTiming(-spacing.xs, { duration: motion.duration('fast') }), withTiming(spacing.xs, { duration: motion.duration('fast') }), withTiming(0, { duration: motion.duration('fast') })); return () => cancelAnimation(x); }, [feedback, motion.level, spacing.xs, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
export function SelectionRing({ selected, children }: { selected: boolean; children: ReactNode }) {
  const { colors, geometry, radius } = useTheme(); const motion = useMotion(); const scale = useSharedValue(1);
  useEffect(() => { scale.value = motion.level === 'full' ? withSpring(selected ? 1 : 0.85, motion.spring('snappy')) : 1; }, [selected, motion.level, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[{ width: geometry.touch, height: geometry.touch, borderRadius: radius.pill, borderWidth: geometry.stroke, borderColor: selected ? colors.primary : colors.border, justifyContent: 'center', alignItems: 'center' }, style]}>{children}</Animated.View>;
}

export function WordChoices({ words, disabled, onChoose }: { words: string[]; disabled: boolean; onChoose: (word: string) => void }) {
  const [chosen, setChosen] = useState<string | null>(null); const { spacing } = useTheme();
  useEffect(() => { if (!disabled) setChosen(null); }, [disabled]);
  return <StaggerList style={{ gap: spacing.sm }}>{words.map(word => <WordCard key={word} word={word} selected={chosen === word} faded={chosen !== null && chosen !== word} disabled={disabled} onPress={() => { setChosen(word); onChoose(word); }} />)}</StaggerList>;
}
function WordCard({ word, selected, faded, disabled, onPress }: { word: string; selected: boolean; faded: boolean; disabled: boolean; onPress: () => void }) {
  const motion = useMotion(); const { spacing } = useTheme(); const scale = useSharedValue(1); const opacity = useSharedValue(1);
  useEffect(() => { scale.value = motion.level === 'full' ? withSpring(selected ? 1.03 : 1, motion.spring('gentle')) : 1; opacity.value = withTiming(faded ? 0.4 : 1, { duration: motion.duration('fast') }); }, [selected, faded, motion.level, scale, opacity]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return <Animated.View style={[{ paddingHorizontal: spacing.xs }, style]}><Button title={word} onPress={onPress} disabled={disabled} variant={selected ? 'primary' : 'secondary'} /></Animated.View>;
}

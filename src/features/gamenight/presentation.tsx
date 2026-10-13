import { useEffect, useRef } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import Animated, { cancelAnimation, runOnJS, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { PressableScale, useMotion, motionTokens } from '@/motion';
import { Card, Text } from '@/ui';
import type { Choice, Round } from './types';
import { fuzzyMatch } from './rules';

const categories = ['sweet', 'funny', 'adventurous', 'deep'];
export function Wheel({ round }: { round: Round }) {
  const { colors, spacing, geometry } = useTheme(); const motion = useMotion();
  const size = geometry.touch * 4; const center = size / 2; const rotation = useSharedValue(0);
  const previous = useRef(''); const lastTick = useRef(0);
  function tick() { const now = Date.now(); if (AppState.currentState === 'active' && now - lastTick.current > motionTokens.fast) { lastTick.current = now; void Haptics.selectionAsync().catch(() => {}); } }
  useAnimatedReaction(() => Math.floor(rotation.value / (Math.PI / 2)), (value, old) => { if (value !== old && old !== null && motion.level === 'full') runOnJS(tick)(); }, [motion.level]);
  useEffect(() => {
    const key = `${round.id}:${round.state.step}:${round.state.spun}:${motion.level}`;
    if (key === previous.current) return;
    previous.current = key; cancelAnimation(rotation);
    if (!round.state.spun) { rotation.value = 0; return; }
    const index = Math.max(0, categories.indexOf(round.state.prompt?.category ?? 'sweet'));
    const target = Math.PI * 8 + Math.PI * 1.5 - (index + 0.5) * Math.PI / 2;
    rotation.value = motion.level === 'full' ? withSpring(target, { ...motion.spring('gentle'), overshootClamping: true }) : target;
    return () => cancelAnimation(rotation);
  }, [round.id, round.state.step, round.state.spun, round.state.prompt?.category, motion.level, rotation]);
  useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state !== 'active') cancelAnimation(rotation); }); return () => listener.remove(); }, [rotation]);
  const transform = useDerivedValue(() => [{ rotate: rotation.value }]);
  const inks = [colors.primary, colors.surfaceAlt, colors.accent, colors.surface];
  return <View style={{ alignItems: 'center', gap: spacing.sm }} accessible accessibilityLabel={`Roulette wheel. ${round.state.spun ? `Selected ${round.state.prompt?.category}` : 'Ready to spin'}`}>
    <Text variant="label">▼</Text><Canvas style={{ width: size, height: size }}><Group origin={{ x: center, y: center }} transform={transform}>{categories.map((category, i) => {
      const path = Skia.Path.Make(); path.moveTo(center, center); path.arcToOval({ x: geometry.stroke, y: geometry.stroke, width: size - geometry.stroke * 2, height: size - geometry.stroke * 2 }, i * 90, 90, false); path.close();
      return <Path key={category} path={path} color={inks[i]} />;
    })}<Circle cx={center} cy={center} r={spacing.lg} color={colors.surface} /></Group></Canvas>
    <Text variant="caption" color="textSecondary">Sweet · Funny · Adventurous · Deep</Text>
  </View>;
}
function Disc({ value, last, winning, row }: { value: number; last: boolean; winning: boolean; row: number }) {
  const { colors, geometry, spacing } = useTheme(); const motion = useMotion(); const drop = useSharedValue(0);
  useEffect(() => { cancelAnimation(drop); if (last && value && motion.level === 'full') { drop.value = -(row + 1) * geometry.touch; drop.value = withSpring(0, motion.spring('gentle')); } else drop.value = 0; return () => cancelAnimation(drop); }, [last, value, row, motion.level, drop, geometry.touch]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));
  return <Animated.View style={[{ width: geometry.touch - spacing.sm, height: geometry.touch - spacing.sm, borderRadius: geometry.touch, backgroundColor: value === 1 ? colors.primary : colors.surfaceAlt, borderColor: winning ? colors.textPrimary : colors.border, borderWidth: winning ? geometry.stroke * 2 : geometry.hairline, alignItems: 'center', justifyContent: 'center' }, style]}><Text color={value === 1 ? 'primaryContrast' : 'textPrimary'} variant="label">{value ? value === 1 ? 'A' : 'B' : '·'}</Text></Animated.View>;
}
export function ConnectBoard({ round, disabled, onMove }: { round: Round; disabled: boolean; onMove: (col: number) => void }) {
  const { spacing, geometry, colors, radius } = useTheme();
  return <View style={{ gap: spacing.sm }}><Text variant="caption">Scroll sideways if needed. Tap a column to drop a disc.</Text><ScrollView horizontal contentContainerStyle={{ gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }}>
    {Array.from({ length: 7 }, (_, col) => <PressableScale key={col} accessibilityRole="button" accessibilityLabel={`Drop in column ${col + 1}. ${Array.from({ length: 6 }, (_, row) => round.state.board[row * 7 + col] === 1 ? 'A' : round.state.board[row * 7 + col] === 2 ? 'B' : 'empty').join(', ')}`} accessibilityState={{ disabled: disabled || round.state.board[col] !== 0 }} disabled={disabled || round.state.board[col] !== 0} onPress={() => onMove(col)} style={{ minWidth: geometry.touch, gap: spacing.xs, alignItems: 'center', paddingVertical: spacing.sm }}>
      <Text variant="label">{col + 1}</Text>{Array.from({ length: 6 }, (_, row) => { const index = row * 7 + col; return <Disc key={row} row={row} value={round.state.board[index] ?? 0} last={round.state.last === index} winning={round.state.line.includes(index)} />; })}
    </PressableScale>)}
  </ScrollView>{round.state.line.length > 0 && <Text accessibilityLiveRegion="polite">Winning four are outlined.</Text>}</View>;
}
function RevealHalf({ choice, label, side }: { choice?: Choice; label: string; side: number }) {
  const { spacing } = useTheme(); const motion = useMotion(); const progress = useSharedValue(0);
  useEffect(() => { progress.value = motion.level === 'off' ? 1 : 0; progress.value = withTiming(1, { duration: motion.duration('slow') }); return () => cancelAnimation(progress); }, [motion.level, progress]);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateX: motion.level === 'full' ? side * motionTokens.travel * (1 - progress.value) : 0 }] }));
  return <Animated.View style={[{ flex: 1 }, style]}><Card style={{ gap: spacing.sm }}><Text variant="caption" color="textSecondary">{label}</Text><Text variant="title/S">{choice?.answer ?? 'Loading revealed answer…'}</Text></Card></Animated.View>;
}
export function Reveal({ round, choices, uid }: { round: Round; choices: Choice[]; uid?: string }) {
  const { spacing } = useTheme(); const mine = choices.find(c => c.author === uid); const theirs = choices.find(c => c.author !== uid);
  const close = mine && theirs && !round.state.prompt?.options.length && fuzzyMatch(mine.answer, theirs.answer);
  return <View style={{ gap: spacing.md }} accessibilityLiveRegion="polite"><Text variant="title/M">{round.state.matched ? round.game === 'rather' ? 'You agree!' : 'You got it!' : round.game === 'rather' ? 'Different picks, more to discover' : 'A new thing to learn'}</Text>
    <View style={{ flexDirection: 'row', gap: spacing.sm }}><RevealHalf choice={mine} label={round.game === 'know' ? round.state.turn === uid ? 'Your answer' : 'Your guess' : 'You chose'} side={-1} /><RevealHalf choice={theirs} label={round.game === 'know' ? round.state.turn === uid ? 'Partner’s guess' : 'Partner’s answer' : 'Partner chose'} side={1} /></View>
    {close && <Text variant="caption">Similar wording detected with Fuse. Scores use the server’s spelling tolerance.</Text>}
  </View>;
}

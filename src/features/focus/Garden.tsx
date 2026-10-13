import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useMotion } from '@/motion';
import { Card, Text, EmptyState, PressableScale } from '@/ui';
import type { FocusLog, Plant } from './types';
import { statistics } from './clock';
function Sprout({ plant, animate }: {
    plant: Plant;
    animate: boolean;
}) {
    const { colors, spacing } = useTheme();
    const motion = useMotion();
    const growth = useSharedValue(1);
    useEffect(() => { if (animate && motion.level === 'full') {
        growth.value = 0;
        growth.value = withTiming(1, { duration: motion.duration('hero') });
    }
    else
        growth.value = 1; }, [animate, motion.level]);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: growth.value }] }));
    return <Animated.View style={[{ width: spacing.s56, height: spacing.s56 }, style]}><Svg width="100%" height="100%" viewBox="0 0 64 72" accessibilityLabel={`${plant.species} grown ${plant.grown_at.slice(0, 10)}`}>
  <Path d="M32 67 Q28 46 34 25" stroke={colors.success} strokeWidth="3" fill="none"/><Ellipse cx="23" cy="51" rx="10" ry="4" rotation="25" origin="23,51" fill={colors.success}/><Ellipse cx="40" cy="44" rx="9" ry="4" rotation="-25" origin="40,44" fill={colors.success}/>
  {plant.species === 'pine' ? <><Path d="M32 4 L15 31 L24 31 L10 48 L54 48 L40 31 L49 31 Z" fill={colors.success}/><Path d="M32 15 L32 48" stroke={colors.textPrimary} opacity="0.3"/></> : plant.species === 'tulip' ? <Path d="M18 12 Q18 40 33 38 Q48 36 49 12 L39 20 L33 8 L26 20 Z" fill={colors.primary}/> : <>{Array.from({ length: plant.species === 'daisy' ? 8 : 5 }, (_, i) => <Ellipse key={i} cx="33" cy="16" rx={plant.species === 'daisy' ? 5 : 9} ry="12" rotation={i * 360 / (plant.species === 'daisy' ? 8 : 5)} origin="33,27" fill={plant.species === 'daisy' ? colors.textPrimary : colors.primary}/>)}<Circle cx="33" cy="27" r="6" fill={colors.warning}/></>}
 </Svg></Animated.View>;
}
export function Garden({ plants, logs, userId, now }: {
    plants: Plant[];
    logs: FocusLog[];
    userId?: string;
    now: number;
}) {
    const { colors, spacing, radius, geometry } = useTheme();
    const [page, setPage] = useState(0);
    const stats = statistics(logs, userId, now);
    const [width, setWidth] = useState(geometry.touch * 6);
    const ordered = [...plants].sort((a, b) => b.grown_at.localeCompare(a.grown_at) || a.id.localeCompare(b.id));
    const visible = ordered.slice(page * 40, (page + 1) * 40);
    const max = Math.max(1, ...stats.bars.flatMap(b => [b.you, b.partner]));
    const height = geometry.touch * 4;
    return <View style={{ gap: spacing.lg }}>
  <Card style={{ gap: spacing.md }}><Text variant="display/M">{plants.length} plants</Text><Text color="textSecondary">Every completed work cycle leaves something growing.</Text>
  {!plants.length ? <EmptyState title="Your garden starts with one quiet moment" description="Finish a work cycle to plant your first flower."/> : <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, overflow: 'hidden' }}>{visible.map((p, i) => <View key={p.id} style={{ position: 'absolute', left: p.x * Math.max(0, width - spacing.s56), top: p.y * (height - spacing.s56) }}><Sprout plant={p} animate={i < geometry.firstScreenful && now - Date.parse(p.grown_at) < 60000}/></View>)}</View>}
  {plants.length > 40 && <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><PressableScale accessibilityRole="button" disabled={page === 0} onPress={() => setPage(p => p - 1)}><Text>Newer plants</Text></PressableScale><PressableScale accessibilityRole="button" disabled={(page + 1) * 40 >= plants.length} onPress={() => setPage(p => p + 1)}><Text>Older plants</Text></PressableScale></View>}
  </Card>
  <Card style={{ gap: spacing.md }}><Text variant="title/M">Time well spent</Text><Text>{stats.streak} day shared streak · Your best: {stats.best} min/day</Text><Text color="textSecondary" variant="caption">UTC days · Completed work only · Joining credits the room’s completed cycles</Text>
  <Text color="textSecondary">This week · You / Partner · Minutes</Text>
  {stats.bars.map(b => <View key={b.day} style={{ gap: spacing.xs }}><Text variant="caption">{b.day.slice(5)} · {b.you} / {b.partner} min</Text><View style={{ height: geometry.track, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }}><View style={{ height: geometry.track, width: `${100 * b.you / max}%`, backgroundColor: colors.primary, borderRadius: radius.pill }}/></View><View style={{ height: geometry.track, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }}><View style={{ height: geometry.track, width: `${100 * b.partner / max}%`, backgroundColor: colors.success, borderRadius: radius.pill }}/></View></View>)}
  </Card>
 </View>;
}

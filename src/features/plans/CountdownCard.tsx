import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Text, Button } from '@/ui';
import { AnimatedNumber, Burst, PressableScale } from '@/motion';
import { useTheme } from '@/theme';
import type { Countdown } from './types';
import { usePlans } from './data';
export function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => { if (timer) clearInterval(timer); timer = undefined; if (AppState.currentState === 'active') { setNow(Date.now()); timer = setInterval(() => setNow(Date.now()), 1000); } };
    update(); const sub = AppState.addEventListener('change', update); return () => { if (timer) clearInterval(timer); sub.remove(); };
  }, []); return now;
}
export function CountdownCard({ item, onPin, onDelete }: { item: Countdown; onPin?: () => void; onDelete?: () => void }) {
  const { spacing, typography } = useTheme(); const now = useClock(); const seconds = Math.max(0, Math.ceil((Date.parse(item.target_at) - now) / 1000));
  const previous = useRef(seconds); const [burst, setBurst] = useState(0);
  useEffect(() => { if (previous.current > 0 && seconds === 0) setBurst(n => n + 1); previous.current = seconds; }, [seconds]);
  return <Card style={{ gap: spacing.md, overflow: 'hidden' }}><Text variant="title/M">{item.emoji} {item.title}</Text>
    {seconds === 0 ? <Text variant="display/M">The moment is here ♡</Text> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}><AnimatedNumber value={Math.floor(seconds / 86400)} style={typography['display/M']} /><Text>days</Text><AnimatedNumber value={Math.floor(seconds / 3600) % 24} style={typography['display/M']} /><Text>h</Text><Text>{Math.floor(seconds / 60) % 60}m {seconds % 60}s</Text></View>}
    {burst > 0 && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><Burst trigger={burst} /></View>}
    {(onPin || onDelete) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{onPin && <Button title={item.pinned ? 'Unpin from Home' : 'Pin to Home'} variant="ghost" onPress={onPin} />}{onDelete && <Button title="Delete" variant="ghost" onPress={onDelete} />}</View>}
  </Card>;
}
export function HomeCard() {
  const plans = usePlans(); const item = plans.countdowns.find(c => c.pinned);
  if (!item) return null;
  return <PressableScale accessibilityRole="button" accessibilityLabel={`Open countdown: ${item.title}`} onPress={() => router.push('/us/plans')}><CountdownCard item={item} /></PressableScale>;
}

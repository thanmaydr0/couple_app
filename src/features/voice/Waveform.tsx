import { useRef } from 'react';
import { View } from 'react-native';
import { PressableScale } from '@/motion';
import { useTheme } from '@/theme';

export function Waveform({ peaks, progress = 0, onSeek }: { peaks: readonly number[]; progress?: number; onSeek?: (fraction: number) => void }) {
  const { colors, geometry, spacing, radius } = useTheme(); const width = useRef(1);
  const bars = <View pointerEvents="none" style={{ flex: 1, height: geometry.touch, flexDirection: 'row', alignItems: 'center', gap: geometry.hairline }}>
    {peaks.map((peak, index) => <View key={index} style={{ flex: 1, height: Math.max(geometry.stroke, Math.min(1, Math.max(0, peak)) * (geometry.touch - spacing.sm)), borderRadius: radius.pill, backgroundColor: index / peaks.length < progress ? colors.primary : colors.textSecondary }} />)}
  </View>;
  return onSeek ? <PressableScale haptic={false} accessibilityRole="adjustable" accessibilityLabel="Voice waveform. Drag to seek" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => onSeek(Math.min(1, Math.max(0, progress + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))}
    onLayout={event => { width.current = event.nativeEvent.layout.width; }}
    onPress={event => onSeek(Math.min(1, Math.max(0, event.nativeEvent.locationX / width.current)))}
    onTouchMove={event => { event.stopPropagation(); onSeek(Math.min(1, Math.max(0, event.nativeEvent.locationX / width.current))); }} style={{ flex: 1 }}>{bars}</PressableScale> : bars;
}

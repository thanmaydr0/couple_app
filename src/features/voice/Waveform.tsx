import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/motion';
import { useTheme } from '@/theme';

export function Waveform({
  peaks,
  progress = 0,
  onSeek,
  inverted = false,
}: {
  peaks: readonly number[];
  progress?: number;
  onSeek?: (fraction: number) => void;
  inverted?: boolean;
}) {
  const { colors, surfaces, radius } = useTheme();
  const width = useRef(1);

  const sampleCount = Math.min(34, Math.max(18, peaks.length));
  const step = peaks.length / sampleCount;
  const sampled = Array.from({ length: sampleCount }, (_, i) => {
    const idx = Math.floor(i * step);
    return Math.max(0.14, Math.min(1, peaks[idx] ?? 0.25));
  });

  const activeColor = inverted ? colors.bubbleMineText : colors.primary;
  const inactiveColor = inverted ? 'rgba(255,255,255,0.34)' : surfaces.rimStrong;

  const bars = (
    <View pointerEvents="none" style={styles.barsContainer}>
      {sampled.map((peak, index) => {
        const isPlayed = progress > 0 && index / sampleCount <= progress;
        const height = Math.max(4, peak * 24);
        return (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height,
                borderRadius: radius.pill,
                backgroundColor: isPlayed ? activeColor : inactiveColor,
              },
            ]}
          />
        );
      })}
    </View>
  );

  return onSeek ? (
    <PressableScale
      sheen={false}
      haptic={false}
      accessibilityRole="adjustable"
      accessibilityLabel="Voice waveform. Drag to seek"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event =>
        onSeek(
          Math.min(
            1,
            Math.max(0, progress + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))
          )
        )
      }
      onLayout={event => {
        width.current = event.nativeEvent.layout.width;
      }}
      onPress={event =>
        onSeek(Math.min(1, Math.max(0, event.nativeEvent.locationX / Math.max(1, width.current))))
      }
      onTouchMove={event => {
        event.stopPropagation();
        onSeek(Math.min(1, Math.max(0, event.nativeEvent.locationX / Math.max(1, width.current))));
      }}
      style={styles.pressable}
    >
      {bars}
    </PressableScale>
  ) : (
    bars
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    minHeight: 34,
    minWidth: 0,
    justifyContent: 'center',
  },
  barsContainer: {
    flex: 1,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  bar: {
    flex: 1,
    maxWidth: 3.5,
  },
});

import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/motion';
import { useTheme } from '@/theme';

export function Waveform({
  peaks,
  progress = 0,
  onSeek,
}: {
  peaks: readonly number[];
  progress?: number;
  onSeek?: (fraction: number) => void;
}) {
  const { colors, radius } = useTheme();
  const width = useRef(1);

  // Take a well-proportioned sample of peaks (up to 36 bars)
  const sampleCount = Math.min(36, Math.max(16, peaks.length));
  const step = peaks.length / sampleCount;
  const sampled = Array.from({ length: sampleCount }, (_, i) => {
    const idx = Math.floor(i * step);
    return Math.max(0.12, Math.min(1, peaks[idx] ?? 0.25));
  });

  const bars = (
    <View pointerEvents="none" style={styles.barsContainer}>
      {sampled.map((peak, index) => {
        const isPlayed = index / sampleCount <= progress;
        const height = Math.max(4, peak * 26);
        return (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height,
                borderRadius: radius.pill,
                backgroundColor: isPlayed ? colors.primary : colors.border,
              },
            ]}
          />
        );
      })}
    </View>
  );

  return onSeek ? (
    <PressableScale
      haptic={false}
      accessibilityRole="adjustable"
      accessibilityLabel="Voice waveform. Drag to seek"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event =>
        onSeek(
          Math.min(
            1,
            Math.max(
              0,
              progress + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)
            )
          )
        )
      }
      onLayout={event => {
        width.current = event.nativeEvent.layout.width;
      }}
      onPress={event =>
        onSeek(Math.min(1, Math.max(0, event.nativeEvent.locationX / width.current)))
      }
      onTouchMove={event => {
        event.stopPropagation();
        onSeek(Math.min(1, Math.max(0, event.nativeEvent.locationX / width.current)));
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
    height: 34,
    justifyContent: 'center',
  },
  barsContainer: {
    flex: 1,
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  bar: {
    flex: 1,
    maxWidth: 4,
  },
});

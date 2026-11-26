import { useEffect, type PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { motionTokens, PressableScale, Skeleton, useMotion } from '@/motion';
import { Card, Text } from '@/ui';
import type { Job } from './service';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Mounted only for the first screenful; recycled tiles are keyed by media ID. */
export function TileEnter({
  children,
  index,
  style,
}: PropsWithChildren<{ index: number; style?: ViewProps['style'] }>) {
  const motion = useMotion();
  const progress = useSharedValue(motion.level === 'off' ? 1 : 0);

  useEffect(() => {
    progress.value = withDelay(
      motion.level === 'full' ? index * motionTokens.stagger : 0,
      motion.level === 'full' ? withSpring(1, motion.spring('gentle')) : withTiming(1, { duration: motion.duration('fast') })
    );
    return () => cancelAnimation(progress);
  }, [motion, index, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: motion.level === 'full' ? 0.92 + 0.08 * progress.value : 1 }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

export function Polaroids() {
  const { colors, surfaces, spacing, radius, geometry } = useTheme();
  const motion = useMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = 0;
    if (motion.level === 'full') drift.value = withRepeat(withTiming(1, { duration: motion.duration('drift') }), -1, true);
    return () => cancelAnimation(drift);
  }, [motion, drift]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: -drift.value * 8 }],
  }));

  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      style={[{ height: geometry.touch * 3, width: geometry.touch * 4, justifyContent: 'center', alignItems: 'center' }, animated]}
    >
      {[-1, 1].map(side => (
        <View
          key={side}
          style={{
            position: 'absolute',
            width: geometry.touch * 2,
            height: geometry.touch * 2 + spacing.md,
            padding: spacing.sm,
            paddingBottom: spacing.lg,
            backgroundColor: colors.bgElevated,
            borderColor: surfaces.rimStrong,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.md,
            transform: [{ translateX: side * spacing.lg }, { rotate: `${side * 7}deg` }],
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: surfaces.softPrimary,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={side < 0 ? 'heart-outline' : 'image-outline'} size={geometry.icon} color={side < 0 ? colors.primary : colors.accent} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

export function TimelineSkeleton() {
  const { spacing, geometry } = useTheme();
  return (
    <View accessibilityLabel="Loading memories" style={{ padding: spacing.lg, gap: spacing.md }}>
      <Skeleton width="45%" height={geometry.icon} />
      {[0, 1].map(row => (
        <View key={row} style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2].map(col => (
            <Skeleton key={col} style={{ flex: 1, aspectRatio: 0.92 }} height={geometry.touch * 2} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function UploadJob({ job, retry }: { job: Job; retry: () => void }) {
  const { colors, surfaces, spacing, geometry } = useTheme();
  const motion = useMotion();
  const progress = useSharedValue(job.progress);
  const check = useSharedValue(0);
  const shake = useSharedValue(0);
  const size = geometry.touch,
    stroke = geometry.stroke,
    r = (size - stroke * 2) / 2;
  const circumference = Math.PI * 2 * r;

  useEffect(() => {
    progress.value = withTiming(job.progress, { duration: motion.duration('base') });
  }, [job.progress, motion, progress]);

  useEffect(() => {
    check.value = withTiming(job.status === 'done' ? 1 : 0, { duration: motion.duration('base') });
    shake.value = 0;
    if (job.status === 'failed' && motion.level === 'full') {
      shake.value = withSequence(
        withTiming(-motionTokens.travel, { duration: motion.duration('fast') }),
        withRepeat(withTiming(motionTokens.travel, { duration: motion.duration('fast') }), 3, true),
        withSpring(0, motion.spring('snappy'))
      );
    }
    return () => cancelAnimation(shake);
  }, [job.status, motion, check, shake]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));
  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: geometry.receiptLength * (1 - check.value),
    opacity: check.value,
  }));
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const failed = job.status === 'failed' || job.status === 'skipped';
  const labels = {
    waiting: 'Waiting',
    preparing: 'Preparing',
    uploading: 'Uploading',
    done: 'Shared with your partner',
    failed: 'Couldn’t upload',
    skipped: 'File skipped',
  };

  return (
    <Animated.View style={animated}>
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={labels[job.status]}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(job.progress * 100) }}
          >
            <Svg width={size} height={size}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={surfaces.rimStrong} strokeWidth={stroke} fill="none" />
              <AnimatedCircle
                animatedProps={ringProps}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={failed ? colors.danger : job.status === 'done' ? colors.success : colors.primary}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={circumference}
                rotation={-90}
                origin={`${size / 2}, ${size / 2}`}
                strokeLinecap="round"
              />
              <AnimatedPath
                animatedProps={checkProps}
                d={`M ${size * 0.3} ${size * 0.5} L ${size * 0.45} ${size * 0.65} L ${size * 0.7} ${size * 0.35}`}
                stroke={colors.success}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={geometry.receiptLength}
                strokeLinecap="round"
              />
            </Svg>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} variant="label">
              {job.asset.fileName ?? job.asset.type ?? 'Memory'}
            </Text>
            <Text variant="body/S" color={failed ? 'danger' : 'textSecondary'}>
              {labels[job.status]} · {Math.round(job.progress * 100)}%
            </Text>
          </View>
        </View>
        {job.error && (
          <Text variant="body/S" color="danger">
            {job.error}
          </Text>
        )}
        {job.status === 'failed' && (
          <PressableScale accessibilityRole="button" onPress={retry} style={{ justifyContent: 'center' }}>
            <Text color="primary" variant="label">
              Retry upload
            </Text>
          </PressableScale>
        )}
      </Card>
    </Animated.View>
  );
}

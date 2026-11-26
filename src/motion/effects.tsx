import { Children, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { StyleSheet, TextInput, View, useWindowDimensions, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Blur, Canvas, Circle, Group } from '@shopify/react-native-skia';
import { useTheme } from '../theme/ThemeProvider';
import { geometry, radius, spacing, typography, type ThemeId } from '../theme/tokens';
import { useMotion } from './useMotion';
import { motionTokens } from './tokens';

export function FadeInView({ delay = 0, style, ...props }: ViewProps & { delay?: number }) {
  const motion = useMotion();
  const value = useSharedValue(motion.level === 'off' ? 1 : 0);

  useEffect(() => {
    cancelAnimation(value);
    if (motion.level === 'off') {
      value.value = 1;
    } else if (motion.level === 'full') {
      value.value = 0;
      value.value = withDelay(delay, withSpring(1, motion.spring('gentle')));
    } else {
      value.value = 0;
      value.value = withTiming(1, { duration: motion.duration('fast') });
    }
    return () => cancelAnimation(value);
  }, [motion, delay, value]);

  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, value.value)),
    transform: [
      { translateY: motion.level === 'full' ? (1 - value.value) * motionTokens.travel : 0 },
      { scale: motion.level === 'full' ? 0.97 + 0.03 * value.value : 1 },
    ],
  }));

  return <Animated.View {...props} style={[style, animated]} />;
}

export function StaggerList({
  children,
  firstScreenful = geometry.firstScreenful,
  ...props
}: PropsWithChildren<ViewProps & { firstScreenful?: number }>) {
  return (
    <View {...props}>
      {Children.map(children, (child, index) =>
        index < firstScreenful ? (
          <FadeInView delay={index * motionTokens.stagger}>{child}</FadeInView>
        ) : (
          child
        )
      )}
    </View>
  );
}

function useLoop(duration: 'shimmer' | 'pulse' | 'heartbeat' | 'drift') {
  const motion = useMotion();
  const value = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(value);
    value.value = 0;
    if (motion.level === 'full') {
      value.value = withRepeat(
        withTiming(1, { duration: motion.duration(duration), easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    }
    return () => cancelAnimation(value);
  }, [motion, duration, value]);

  return { value, level: motion.level };
}

export function Skeleton({
  width = '100%',
  height = geometry.touch,
  style,
}: {
  width?: ViewStyle['width'];
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, surfaces } = useTheme();
  const { value, level } = useLoop('shimmer');

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: (value.value * 2 - 1) * geometry.particleTravel }],
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        {
          width,
          height,
          overflow: 'hidden',
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: surfaces.rim,
        },
        style,
      ]}
    >
      {level === 'full' && (
        <Animated.View
          importantForAccessibility="no-hide-descendants"
          style={[{ width: '100%', height: '100%' }, animated]}
        >
          <LinearGradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            colors={['transparent', surfaces.rimStrong, 'transparent']}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

export function PulseRing({
  size = spacing.s56,
  children,
  style,
}: PropsWithChildren<{ size?: number; style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  const { value, level } = useLoop('pulse');

  const outerStyle = useAnimatedStyle(() => ({
    opacity: level === 'full' ? 0.65 - value.value * 0.6 : 0.4,
    transform: [{ scale: level === 'full' ? 1 + value.value * 0.24 : 1 }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    opacity: level === 'full' ? 0.9 - value.value * 0.45 : 0.7,
    transform: [{ scale: level === 'full' ? 1 + value.value * 0.11 : 1 }],
  }));

  return (
    <View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: radius.pill,
            borderWidth: 1.5,
            borderColor: colors.primary,
          },
          outerStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.accent,
          },
          innerStyle,
        ]}
      />
      {children}
    </View>
  );
}

export function HeartbeatView({ style, ...props }: ViewProps) {
  const { value, level } = useLoop('heartbeat');

  const animated = useAnimatedStyle(() => ({
    transform: [
      { scale: level === 'full' ? 1 + Math.sin(value.value * Math.PI) * 0.055 : 1 },
    ],
  }));

  return <Animated.View {...props} style={[style, animated]} />;
}

export function ParallaxHeader({
  scrollY,
  style,
  ...props
}: ViewProps & { scrollY: SharedValue<number> }) {
  const { level } = useMotion();

  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateY: level === 'full' ? Math.max(0, scrollY.value) * geometry.parallax : 0 },
    ],
  }));

  return <Animated.View {...props} style={[style, animated]} />;
}

const AnimatedInput = Animated.createAnimatedComponent(TextInput);

export function AnimatedNumber({
  value,
  style,
  accessibilityLabel,
}: {
  value: number;
  style?: import('react-native').TextStyle;
  accessibilityLabel?: string;
}) {
  const motion = useMotion();
  const count = useSharedValue(value);

  useEffect(() => {
    count.value =
      motion.level === 'full'
        ? withTiming(value, { duration: motion.duration('count'), easing: Easing.out(Easing.cubic) })
        : value;
  }, [value, motion, count]);

  const props = useAnimatedProps(() => ({
    text: String(Math.round(count.value)),
    defaultValue: String(Math.round(count.value)),
  }));

  const { colors } = useTheme();

  return (
    <AnimatedInput
      editable={false}
      accessible
      accessibilityLabel={accessibilityLabel ?? String(value)}
      underlineColorAndroid="transparent"
      animatedProps={props}
      style={[
        typography['title/L'],
        { color: colors.textPrimary, fontVariant: ['tabular-nums'], padding: 0 },
        style,
      ]}
    />
  );
}

function Particle({
  progress,
  index,
  color,
}: {
  progress: SharedValue<number>;
  index: number;
  color: string;
}) {
  const angle = index * 2.39996;
  const distance = geometry.particleTravel * (0.45 + (index % 7) / 8);
  const x = useDerivedParticle(progress, Math.cos(angle) * distance, false);
  const y = useDerivedParticle(progress, Math.sin(angle) * distance, true);
  const opacity = useParticleOpacity(progress);

  return <Circle cx={x} cy={y} r={geometry.particle * 1.25} color={color} opacity={opacity} />;
}

function useDerivedParticle(progress: SharedValue<number>, distance: number, gravity: boolean) {
  return useDerivedValue(
    () =>
      geometry.particleTravel +
      distance * progress.value +
      (gravity ? spacing.s56 * progress.value * progress.value : 0)
  );
}

function useParticleOpacity(progress: SharedValue<number>) {
  return useDerivedValue(() => 1 - progress.value);
}

export function Burst({
  trigger,
  count = geometry.maxParticles,
}: {
  trigger: number;
  count?: number;
}) {
  const motion = useMotion();
  const { colors } = useTheme();
  const progress = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 1;
    if (motion.level === 'full' && trigger > 0) {
      progress.value = 0;
      progress.value = withTiming(1, { duration: motion.duration('particles') });
    }
  }, [trigger, motion, progress]);

  if (motion.level !== 'full') return null;

  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={{ width: geometry.particleTravel * 2.2, height: geometry.particleTravel * 2.2 }}
    >
      <Canvas style={{ flex: 1 }}>
        {Array.from(
          { length: Math.max(0, Math.min(60, Math.floor(count))) },
          (_, i) => (
            <Particle
              key={i}
              index={i}
              progress={progress}
              color={i % 2 ? colors.primary : colors.accent}
            />
          )
        )}
      </Canvas>
    </View>
  );
}

export function DriftingGradient() {
  const { colors } = useTheme();
  const { value, level } = useLoop('drift');

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: value.value * motionTokens.travel }],
  }));

  if (level !== 'full') return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: -spacing.md, bottom: -spacing.md, left: 0, right: 0, opacity: 0.45 },
        animated,
      ]}
    >
      <LinearGradient colors={[colors.bg, colors.surface, colors.bg]} style={{ flex: 1 }} />
    </Animated.View>
  );
}

const ATMOSPHERE_PALETTES: Record<ThemeId, { glow1: string; glow2: string; glow3: string }> = {
  Auto: { glow1: '#8A294B', glow2: '#744A77', glow3: '#EBA5B5' },
  Midnight: { glow1: '#4F46E5', glow2: '#C026D3', glow3: '#3B82F6' },
  Noir: { glow1: '#F43F5E', glow2: '#52525B', glow3: '#E11D48' },
  Rose: { glow1: '#FB7185', glow2: '#F472B6', glow3: '#FDBA74' },
  Sunset: { glow1: '#F97316', glow2: '#EC4899', glow3: '#EAB308' },
  Ocean: { glow1: '#06B6D4', glow2: '#3B82F6', glow3: '#14B8A6' },
  Lavender: { glow1: '#A855F7', glow2: '#EC4899', glow3: '#818CF8' },
  Forest: { glow1: '#10B981', glow2: '#06B6D4', glow3: '#84CC16' },
};

/** GPU-blurred Skia ambient mesh backdrop that breathes silently on UI thread. */
export function ThemeAtmosphere() {
  const { resolvedTheme, dark } = useTheme();
  const motion = useMotion();
  const { width, height } = useWindowDimensions();
  const breath = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(breath);
    if (motion.level === 'full') {
      breath.value = 0;
      breath.value = withRepeat(
        withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    } else {
      breath.value = 0.35;
    }
    return () => cancelAnimation(breath);
  }, [motion.level, breath]);

  const c1x = useDerivedValue(() => width * 0.85 - Math.sin(breath.value * Math.PI) * 55);
  const c1y = useDerivedValue(() => height * 0.14 + Math.cos(breath.value * Math.PI) * 35);
  const c2x = useDerivedValue(() => width * 0.16 + Math.sin(breath.value * Math.PI) * 45);
  const c2y = useDerivedValue(() => height * 0.72 - Math.cos(breath.value * Math.PI) * 45);
  const c3x = useDerivedValue(() => width * 0.55 + Math.cos(breath.value * Math.PI) * 40);
  const c3y = useDerivedValue(() => height * 0.44 + Math.sin(breath.value * Math.PI) * 30);

  if (motion.level === 'off') return null;

  const selectedTheme = resolvedTheme in ATMOSPHERE_PALETTES ? resolvedTheme : 'Auto';
  const { glow1, glow2, glow3 } = ATMOSPHERE_PALETTES[selectedTheme];
  const opacityScale = dark ? 0.18 : 0.12;

  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group opacity={opacityScale}>
          <Blur blur={76} />
          <Circle cx={c1x} cy={c1y} r={width * 0.42} color={glow1} />
          <Circle cx={c2x} cy={c2y} r={width * 0.38} color={glow2} />
          <Circle cx={c3x} cy={c3y} r={width * 0.3} color={glow3} />
        </Group>
      </Canvas>
    </View>
  );
}

export function ThemeTransitionWave() {
  const { colors } = useTheme();
  const motion = useMotion();
  const transition = useSharedValue(1);
  const [waveColor, setWaveColor] = useState(colors.bg);
  const prevBg = useRef(colors.bg);

  useEffect(() => {
    if (prevBg.current !== colors.bg) {
      setWaveColor(colors.bg);
      prevBg.current = colors.bg;
      cancelAnimation(transition);
      transition.value = 0;
      transition.value = withTiming(1, { duration: motion.duration('theme') });
    }
  }, [colors.bg, motion, transition]);

  const animatedStyle = useAnimatedStyle(() => {
    if (transition.value >= 1 || motion.level !== 'full') return { opacity: 0 };
    return {
      opacity: (1 - transition.value) * 0.85,
      transform: [{ scale: 1 + transition.value * 0.03 }],
    };
  });

  if (motion.level !== 'full') return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: waveColor,
          zIndex: 9999,
        },
        animatedStyle,
      ]}
    />
  );
}

/** Expressive kinetic floating heart bloom with orbiting sparkle */
export function FloatingHeart({
  trigger,
  x = 120,
  y = 120,
}: {
  trigger: number;
  x?: number;
  y?: number;
}) {
  const { colors } = useTheme();
  const motion = useMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (trigger > 0 && motion.level === 'full') {
      cancelAnimation(progress);
      progress.value = 0;
      progress.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) });
    }
  }, [trigger, motion.level, progress]);

  const mainHeartStyle = useAnimatedStyle(() => {
    if (progress.value === 0 || progress.value >= 1) return { opacity: 0 };
    const opacity =
      progress.value < 0.16 ? progress.value / 0.16 : 1 - (progress.value - 0.16) / 0.84;
    const sway = Math.sin(progress.value * Math.PI * 2) * 14;
    return {
      opacity,
      transform: [
        { scale: 0.65 + progress.value * 0.75 },
        { translateY: -progress.value * 68 },
        { translateX: sway },
        { rotate: `${sway * 1.4}deg` },
      ],
    };
  });

  const sparkleLeftStyle = useAnimatedStyle(() => {
    if (progress.value === 0 || progress.value >= 1) return { opacity: 0 };
    const opacity = (1 - progress.value) * 0.85;
    return {
      opacity,
      transform: [
        { scale: 0.4 + progress.value * 0.5 },
        { translateY: -progress.value * 52 - 10 },
        { translateX: -16 - progress.value * 18 },
      ],
    };
  });

  const sparkleRightStyle = useAnimatedStyle(() => {
    if (progress.value === 0 || progress.value >= 1) return { opacity: 0 };
    const opacity = (1 - progress.value) * 0.85;
    return {
      opacity,
      transform: [
        { scale: 0.4 + progress.value * 0.5 },
        { translateY: -progress.value * 58 - 6 },
        { translateX: 16 + progress.value * 18 },
      ],
    };
  });

  if (trigger === 0 || motion.level !== 'full') return null;

  return (
    <View pointerEvents="none" style={[{ position: 'absolute', left: x - 18, top: y - 18, zIndex: 9999 }]}>
      <Animated.View style={mainHeartStyle}>
        <Ionicons name="heart" size={38} color={colors.primary} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, sparkleLeftStyle]}>
        <Ionicons name="sparkles" size={18} color={colors.accent} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, sparkleRightStyle]}>
        <Ionicons name="heart" size={16} color={colors.primary} />
      </Animated.View>
    </View>
  );
}

/** Liquid bouncing wave typing animation for chat */
export function LiquidTypingWave() {
  const { colors } = useTheme();
  const motion = useMotion();
  const wave = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(wave);
    if (motion.level === 'full') {
      wave.value = 0;
      wave.value = withRepeat(withTiming(1, { duration: 1050, easing: Easing.linear }), -1, false);
    }
    return () => cancelAnimation(wave);
  }, [motion.level, wave]);

  const dot1Style = useAnimatedStyle(() => {
    const p = (wave.value + 0) % 1;
    const y = Math.sin(p * Math.PI) * -5;
    const s = 0.85 + Math.sin(p * Math.PI) * 0.25;
    return { transform: [{ translateY: y }, { scale: s }] };
  });

  const dot2Style = useAnimatedStyle(() => {
    const p = (wave.value + 0.22) % 1;
    const y = Math.sin(p * Math.PI) * -5;
    const s = 0.85 + Math.sin(p * Math.PI) * 0.25;
    return { transform: [{ translateY: y }, { scale: s }] };
  });

  const dot3Style = useAnimatedStyle(() => {
    const p = (wave.value + 0.44) % 1;
    const y = Math.sin(p * Math.PI) * -5;
    const s = 0.85 + Math.sin(p * Math.PI) * 0.25;
    return { transform: [{ translateY: y }, { scale: s }] };
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, height: 18 }}>
      <Animated.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.primary }, dot1Style]} />
      <Animated.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.primary }, dot2Style]} />
      <Animated.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.primary }, dot3Style]} />
    </View>
  );
}

import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useMotion } from '@/motion';
import { Text } from '@/ui';
export function Ring({ progress, seconds, phase, phaseKey }: {
    progress: number;
    seconds: number;
    phase: string;
    phaseKey: string;
}) {
    const { colors, spacing, geometry } = useTheme();
    const motion = useMotion();
    const size = geometry.touch * 5;
    const stroke = spacing.sm;
    const r = (size - stroke) / 2;
    const path = useMemo(() => Skia.Path.Make().addCircle(size / 2, size / 2, r), [size, r]);
    const end = useSharedValue(progress);
    const opacity = useSharedValue(1);
    useEffect(() => { end.value = withTiming(progress, { duration: motion.duration('base') }); }, [progress, motion.level]);
    useEffect(() => { opacity.value = motion.level === 'off' ? 1 : 0; opacity.value = withTiming(1, { duration: motion.duration('slow') }); }, [phaseKey, motion.level]);
    const whole = Math.ceil(seconds);
    const time = `${Math.floor(whole / 60).toString().padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`;
    return <View style={{ width: size, height: size, alignSelf: 'center', justifyContent: 'center', alignItems: 'center' }}>
  <Canvas accessible={false} style={{ position: 'absolute', width: size, height: size }}><Circle cx={size / 2} cy={size / 2} r={r} color={colors.surfaceAlt} style="stroke" strokeWidth={stroke}/><Path path={path} start={0} end={end} color={colors.primary} style="stroke" strokeWidth={stroke} strokeCap="round" opacity={opacity}/></Canvas>
  <Text variant="display/XL" accessibilityLabel={`${Math.floor(whole / 60)} minutes ${whole % 60} seconds remaining`}>{time}</Text><Text color="textSecondary">{phase}</Text>
 </View>;
}

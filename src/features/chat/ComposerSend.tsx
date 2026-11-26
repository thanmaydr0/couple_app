import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme';
import { PressableScale, useMotion } from '@/motion';
import { useChatStyles } from './styles';

export function ComposerSend({
  visible,
  disabled,
  onPress,
  onLongPress,
}: {
  visible: boolean;
  disabled: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useChatStyles();
  const motion = useMotion();
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    progress.value =
      motion.level === 'full'
        ? withSpring(visible ? 1 : 0, motion.spring('bouncy'))
        : withTiming(visible ? 1 : 0, { duration: motion.duration('fast') });
  }, [visible, motion, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: motion.level === 'full' ? 0.5 + progress.value * 0.5 : 1 },
      { rotate: `${motion.level === 'full' ? (1 - progress.value) * -45 : 0}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[{ width: 40, height: 40 }, animated]}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Send message. Hold to send later"
        disabled={!visible || disabled}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.send}
      >
        <Ionicons name="arrow-up" size={20} color={colors.primaryContrast} />
      </PressableScale>
    </Animated.View>
  );
}

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { PressableScale, useMotion, motionTokens, FloatingHeart } from '@/motion';
import { MessageStatusTicks } from '@/ui';
import { dayLabel, type ChatMessage } from './model';
import { ReplyPreview } from './ReplyPreview';
import { VoicePlayer } from '@/features/voice';
import { ChatImage } from './ChatImage';
import { useChatStyles } from './styles';
import { bodyText, firstLink } from './body';
import { ReactionChips } from './ReactionChips';
import { LinkCard } from './LinkCard';
import type { Reaction } from './types';

function Receipt({ message }: { message: ChatMessage }) {
  const status = message.status === 'sent' && message.read_at ? 'seen' : message.status;
  const previous = useRef(status);
  const motion = useMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (previous.current === 'sending' && (status === 'sent' || status === 'seen') && motion.level === 'full') {
      scale.value = 0;
      scale.value = withSpring(1, motion.spring('snappy'));
    }
    previous.current = status;
  }, [status, motion.level, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { colors, radius, geometry } = useTheme();

  if (message.deleted_at || message.kind === 'system') return null;

  return (
    <Animated.View style={[status === 'failed' && { backgroundColor: colors.surface, borderRadius: radius.pill }, animated]}>
      <MessageStatusTicks status={status} />
      {message.kind === 'voice' && !!message.meta?.played_at && (
        <Ionicons accessibilityLabel="Voice heard" name="mic" size={geometry.dot} color={colors.bubbleMineText} />
      )}
    </Animated.View>
  );
}

/** Computes squircle continuous corner curvature based on message grouping */
function getBubbleRadii(mine: boolean, sameOlder: boolean, sameNewer: boolean) {
  const R_LARGE = 20;
  const R_SMALL = 5;

  if (mine) {
    if (!sameOlder && !sameNewer) {
      // Single
      return { borderTopLeftRadius: R_LARGE, borderTopRightRadius: R_LARGE, borderBottomLeftRadius: R_LARGE, borderBottomRightRadius: R_SMALL };
    }
    if (!sameOlder && sameNewer) {
      // First in cluster
      return { borderTopLeftRadius: R_LARGE, borderTopRightRadius: R_LARGE, borderBottomLeftRadius: R_LARGE, borderBottomRightRadius: R_SMALL };
    }
    if (sameOlder && sameNewer) {
      // Middle in cluster
      return { borderTopLeftRadius: R_LARGE, borderTopRightRadius: R_SMALL, borderBottomLeftRadius: R_LARGE, borderBottomRightRadius: R_SMALL };
    }
    // Last in cluster
    return { borderTopLeftRadius: R_LARGE, borderTopRightRadius: R_SMALL, borderBottomLeftRadius: R_LARGE, borderBottomRightRadius: R_LARGE };
  } else {
    if (!sameOlder && !sameNewer) {
      // Single
      return { borderTopLeftRadius: R_LARGE, borderTopRightRadius: R_LARGE, borderBottomLeftRadius: R_SMALL, borderBottomRightRadius: R_LARGE };
    }
    if (!sameOlder && sameNewer) {
      // First in cluster
      return { borderTopLeftRadius: R_LARGE, borderTopRightRadius: R_LARGE, borderBottomLeftRadius: R_SMALL, borderBottomRightRadius: R_LARGE };
    }
    if (sameOlder && sameNewer) {
      // Middle in cluster
      return { borderTopLeftRadius: R_SMALL, borderTopRightRadius: R_LARGE, borderBottomLeftRadius: R_SMALL, borderBottomRightRadius: R_LARGE };
    }
    // Last in cluster
    return { borderTopLeftRadius: R_SMALL, borderTopRightRadius: R_LARGE, borderBottomLeftRadius: R_LARGE, borderBottomRightRadius: R_LARGE };
  }
}

type Props = {
  message: ChatMessage;
  uid: string;
  partnerName: string;
  sameOlder: boolean;
  sameNewer: boolean;
  showDate: boolean;
  knownReply?: ChatMessage;
  highlighted: boolean;
  animateArrival: boolean;
  onReply: (message: ChatMessage) => void;
  onActions: (message: ChatMessage) => void;
  onRetry: (message: ChatMessage) => void;
  claimEntrance: (message: ChatMessage) => boolean;
  reactions?: Reaction[];
  onReact: (message: ChatMessage, emoji: string, ensure?: boolean) => void;
  onJump: (id: string) => void;
};

function Bubble({
  message,
  uid,
  partnerName,
  sameOlder,
  sameNewer,
  showDate,
  knownReply,
  highlighted,
  animateArrival,
  onReply,
  onActions,
  onRetry,
  claimEntrance,
  reactions,
  onReact,
  onJump,
}: Props) {
  const styles = useChatStyles();
  const { colors, spacing, radius, geometry, dark } = useTheme();
  const motion = useMotion();
  const mine = message.sender_id === uid;
  const lastTap = useRef(0);
  const [heartTrigger, setHeartTrigger] = useState(0);
  const [tapCoords, setTapCoords] = useState<{ x: number; y: number }>({ x: 80, y: 20 });
  const text = bodyText(message, uid, message.sender_id);
  const link = !message.deleted_at ? firstLink(message.body) : null;

  const enter = useSharedValue(1);
  const translate = useSharedValue(0);
  const crossed = useSharedValue(false);
  const highlight = useSharedValue(1);

  useEffect(() => {
    if (!claimEntrance(message) || !animateArrival) return;
    enter.value = 0;
    enter.value =
      motion.level === 'full'
        ? withSpring(1, motion.spring('gentle'))
        : withTiming(1, { duration: motion.duration('fast') });
  }, []);

  useEffect(() => {
    highlight.value =
      motion.level === 'full'
        ? withSpring(highlighted ? motionTokens.pressScale : 1, motion.spring('snappy'))
        : 1;
  }, [highlighted, motion.level, highlight]);

  const animated = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      {
        translateX:
          translate.value +
          (motion.level === 'full' ? (1 - enter.value) * motionTokens.travel * (mine ? 1 : -1) : 0),
      },
      {
        scale:
          highlight.value *
          (motion.level === 'full' ? motionTokens.pressScale + (1 - motionTokens.pressScale) * enter.value : 1),
      },
    ],
  }));

  const arrowStyle = useAnimatedStyle(() => {
    const scale = Math.min(1.2, Math.max(0.4, translate.value / 44));
    const opacity = Math.min(1, translate.value / 24);
    return {
      opacity,
      transform: [
        { translateX: Math.min(translate.value - 36, 12) },
        { scale },
      ],
    };
  });

  const haptic = () => {
    if (motion.level === 'full') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  };

  const reply = () => onReply(message);

  const swipe = useMemo(() => {
    return Gesture.Pan()
      .enabled(
        message.kind !== 'voice' &&
          message.status === 'sent' &&
          !message.deleted_at &&
          message.kind !== 'system'
      )
      .activeOffsetX(spacing.md)
      .failOffsetY([-spacing.sm, spacing.sm])
      .onUpdate(event => {
        // Logarithmic kinetic drag resistance
        const raw = Math.max(0, event.translationX);
        const resisted = raw * (1 - 1 / (raw / 40 + 1));
        translate.value = Math.min(64, resisted);
        if (translate.value >= 40 && !crossed.value) {
          crossed.value = true;
          scheduleOnRN(haptic);
        } else if (translate.value < 40 && crossed.value) {
          crossed.value = false;
        }
      })
      .onEnd(() => {
        if (translate.value >= 40) {
          scheduleOnRN(reply);
        }
      })
      .onFinalize(() => {
        crossed.value = false;
        translate.value =
          motion.level === 'full' ? withSpring(0, motion.spring('snappy')) : 0;
      });
  }, [
    message.kind,
    message.status,
    message.deleted_at,
    spacing.md,
    spacing.sm,
    translate,
    crossed,
    motion.level,
  ]);

  const bubbleRadii = useMemo(
    () => getBubbleRadii(mine, sameOlder, sameNewer),
    [mine, sameOlder, sameNewer]
  );

  return (
    <View style={{ marginBottom: sameNewer ? 2 : 10 }}>
      {showDate && (
        <View style={styles.date}>
          <Text style={styles.dateText}>{dayLabel(message.created_at)}</Text>
        </View>
      )}

      <View
        style={[
          styles.messageRow,
          {
            alignItems: mine ? 'flex-end' : 'flex-start',
            marginTop: sameOlder ? 2 : 8,
          },
        ]}
      >
        {/* Spring-loaded swipe-to-reply indicator */}
        <Animated.View pointerEvents="none" style={[styles.swipeIndicator, arrowStyle]}>
          <View style={[styles.swipeIconCircle, { backgroundColor: colors.surfaceAlt, borderColor: colors.primary }]}>
            <Ionicons name="arrow-undo" size={16} color={colors.primary} />
          </View>
        </Animated.View>

        <GestureDetector gesture={swipe}>
          <Animated.View style={[{ maxWidth: '84%' }, animated]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                message.status === 'failed'
                  ? 'Message failed. Tap to retry'
                  : `${mine ? 'You' : partnerName}: ${text || (message.kind === 'voice' ? 'Voice message' : 'Photo')}. Hold for message actions`
              }
              accessibilityActions={[{ name: 'longpress', label: 'Message actions' }]}
              onAccessibilityAction={() => onActions(message)}
              onLongPress={() => onActions(message)}
              delayLongPress={motionTokens.slow}
              onPress={e => {
                if (message.status === 'failed') {
                  onRetry(message);
                  return;
                }
                const now = Date.now();
                if (
                  now - lastTap.current < motionTokens.slow &&
                  !message.deleted_at &&
                  message.kind !== 'system'
                ) {
                  const { locationX, locationY } = e.nativeEvent;
                  setTapCoords({ x: locationX, y: locationY });
                  onReact(message, '❤️', true);
                  setHeartTrigger(t => t + 1);
                  lastTap.current = 0;
                } else {
                  lastTap.current = now;
                }
              }}
              style={[
                styles.bubble,
                mine ? styles.mine : styles.theirs,
                bubbleRadii,
                {
                  borderWidth: highlighted ? 2 : StyleSheet.hairlineWidth,
                  borderColor: highlighted
                    ? colors.primary
                    : mine
                    ? 'transparent'
                    : colors.border,
                  shadowColor: colors.shadowColor,
                  shadowOpacity: dark ? 0.3 : 0.08,
                  shadowRadius: 5,
                  elevation: 2,
                },
              ]}
            >
              {mine && (
                <LinearGradient
                  pointerEvents="none"
                  colors={[colors.bubbleMineStart, colors.bubbleMineEnd]}
                  style={StyleSheet.absoluteFill}
                />
              )}

              {/* Floating heart micro-bloom on double-tap */}
              <FloatingHeart trigger={heartTrigger} x={tapCoords.x} y={tapCoords.y} />

              {!message.deleted_at && message.reply_to && (
                <ReplyPreview message={message} uid={uid} known={knownReply} onJump={onJump} />
              )}

              {!message.deleted_at && message.kind === 'image' && (
                <ChatImage
                  message={message}
                  uid={uid}
                  onReply={() => onActions(message)}
                  onHeart={() => {
                    onReact(message, '❤️', true);
                    setHeartTrigger(t => t + 1);
                  }}
                />
              )}

              {!message.deleted_at && !message.decryptionError && message.kind === 'voice' && (
                <VoicePlayer
                  id={message.id}
                  path={message.media_path}
                  encrypted={!!message.enc}
                  uri={message.status !== 'sent' ? message.localUri : undefined}
                  couple={message.couple_id}
                  receiver={!mine}
                  meta={message.meta}
                />
              )}

              {!!text && <Text style={[styles.body, mine && styles.mineText]}>{text}</Text>}

              {link && <LinkCard url={link} couple={message.couple_id} uid={uid} animate={animateArrival} />}

              {message.kind === 'system' && !text && <Text style={styles.body}>System message</Text>}

              <View style={styles.meta}>
                <Text style={[styles.time, mine && styles.mineText]}>
                  {message.kind !== 'system' ? (message.enc ? '🔒 ' : '') : ''}
                  {message.pinned_at ? '📌 ' : ''}
                  {message.edited_at && !message.deleted_at ? 'edited · ' : ''}
                  {new Date(message.created_at).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                {mine && <Receipt message={message} />}
              </View>
            </PressableScale>
          </Animated.View>
        </GestureDetector>

        {!message.deleted_at && reactions && reactions.length > 0 && (
          <ReactionChips
            reactions={reactions}
            uid={uid}
            animate={animateArrival}
            onReact={emoji => onReact(message, emoji)}
          />
        )}

        {mine && message.status === 'failed' && (
          <PressableScale
            onPress={() => onRetry(message)}
            accessibilityRole="button"
            style={styles.retry}
          >
            <Text style={styles.errorText}>Couldn’t send · Tap to retry</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

export const MessageBubble = memo(
  Bubble,
  (a, b) =>
    a.message === b.message &&
    a.uid === b.uid &&
    a.partnerName === b.partnerName &&
    a.reactions === b.reactions &&
    a.onReact === b.onReact &&
    a.onJump === b.onJump &&
    a.knownReply?.deleted_at === b.knownReply?.deleted_at &&
    a.sameOlder === b.sameOlder &&
    a.sameNewer === b.sameNewer &&
    a.showDate === b.showDate &&
    a.highlighted === b.highlighted &&
    a.animateArrival === b.animateArrival &&
    a.knownReply?.id === b.knownReply?.id &&
    a.knownReply?.body === b.knownReply?.body &&
    a.knownReply?.kind === b.knownReply?.kind &&
    a.knownReply?.sender_id === b.knownReply?.sender_id &&
    a.onReply === b.onReply &&
    a.onActions === b.onActions &&
    a.onRetry === b.onRetry &&
    a.claimEntrance === b.claimEntrance
);

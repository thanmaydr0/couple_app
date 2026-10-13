import { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { PressableScale, useMotion, motionTokens } from '@/motion';
import { MessageStatusTicks } from '@/ui';
import { dayLabel, type ChatMessage } from './model';
import { ReplyPreview } from './ReplyPreview';
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
  const { colors, radius } = useTheme();
  if (message.deleted_at || message.kind === 'system') return null;
  return <Animated.View style={[status === 'failed' && { backgroundColor: colors.surface, borderRadius: radius.pill }, animated]}><MessageStatusTicks status={status} /></Animated.View>;
}

type Props = {
  message: ChatMessage; uid: string; partnerName: string; sameOlder: boolean; sameNewer: boolean;
  showDate: boolean; knownReply?: ChatMessage; highlighted: boolean; animateArrival: boolean;
  onReply: (message: ChatMessage) => void; onActions: (message: ChatMessage) => void;
  onRetry: (message: ChatMessage) => void; claimEntrance: (message: ChatMessage) => boolean;
  reactions?: Reaction[]; onReact: (message: ChatMessage, emoji: string, ensure?: boolean) => void; onJump: (id: string) => void;
};

function Bubble({ message, uid, partnerName, sameOlder, sameNewer, showDate, knownReply, highlighted, animateArrival, onReply, onActions, onRetry, claimEntrance, reactions, onReact, onJump }: Props) {
  const styles = useChatStyles();
  const { colors, spacing, radius, geometry } = useTheme();
  const motion = useMotion();
  const mine = message.sender_id === uid;
  const lastTap = useRef(0);
  const text = bodyText(message, uid, message.sender_id);
  const link = !message.deleted_at ? firstLink(message.body) : null;
  const enter = useSharedValue(1);
  const translate = useSharedValue(0);
  const crossed = useSharedValue(false);
  const highlight = useSharedValue(1);
  useEffect(() => {
    if (!claimEntrance(message) || !animateArrival) return;
    enter.value = 0;
    enter.value = motion.level === 'full' ? withSpring(1, motion.spring('gentle')) : withTiming(1, { duration: motion.duration('fast') });
    // Only claim on mount; receipt updates must not replay bubble entrances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    highlight.value = motion.level === 'full' ? withSpring(highlighted ? motionTokens.pressScale : 1, motion.spring('snappy')) : 1;
  }, [highlighted, motion.level, highlight]);
  const animated = useAnimatedStyle(() => ({ opacity: enter.value, transform: [
    { translateX: translate.value + (motion.level === 'full' ? (1 - enter.value) * motionTokens.travel * (mine ? 1 : -1) : 0) },
    { scale: highlight.value * (motion.level === 'full' ? motionTokens.pressScale + (1 - motionTokens.pressScale) * enter.value : 1) },
  ] }));
  const arrow = useAnimatedStyle(() => ({ opacity: Math.min(1, translate.value / geometry.touch) }));
  const haptic = () => { if (motion.level === 'full') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
  const reply = () => onReply(message);
  const swipe = Gesture.Pan().enabled(message.status === 'sent' && !message.deleted_at && message.kind !== 'system').activeOffsetX(spacing.md).failOffsetY([-spacing.sm, spacing.sm])
    .onUpdate(event => {
      translate.value = Math.max(0, Math.min(geometry.touch + spacing.md, event.translationX));
      if (translate.value >= geometry.touch && !crossed.value) { crossed.value = true; scheduleOnRN(haptic); }
    }).onEnd(() => { if (translate.value >= geometry.touch) scheduleOnRN(reply); })
    .onFinalize(() => { crossed.value = false; translate.value = motion.level === 'full' ? withSpring(0, motion.spring('snappy')) : 0; });
  return <View>
    {showDate && <View style={styles.date}><Text style={styles.dateText}>{dayLabel(message.created_at)}</Text></View>}
    <View style={[styles.messageRow, { alignItems: mine ? 'flex-end' : 'flex-start', marginTop: sameOlder ? spacing.xs : spacing.s12 }]}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: spacing.s12 }, arrow]}><Ionicons name="arrow-undo" size={geometry.icon} color={colors.primary} /></Animated.View>
      <GestureDetector gesture={swipe}><Animated.View style={[{ maxWidth: '85%' }, animated]}>
        <PressableScale accessibilityRole="button" accessibilityLabel={message.status === 'failed' ? 'Message failed. Tap to retry' : `${mine ? 'You' : partnerName}: ${text || 'Photo'}. Hold for message actions`}
          accessibilityActions={[{ name: 'longpress', label: 'Message actions' }]}
          onAccessibilityAction={() => onActions(message)} onLongPress={() => onActions(message)} delayLongPress={motionTokens.slow}
          onPress={() => { if (message.status === 'failed') { onRetry(message); return; } const now = Date.now(); if (now - lastTap.current < motionTokens.slow && !message.deleted_at && message.kind !== 'system') { onReact(message, '❤️', true); lastTap.current = 0; } else lastTap.current = now; }} style={[styles.bubble, { maxWidth: '100%', borderWidth: geometry.stroke, borderColor: highlighted ? colors.primary : mine ? colors.bubbleMineStart : colors.bubbleTheirs }, mine ? styles.mine : styles.theirs, {
            borderTopRightRadius: mine && sameOlder ? radius.sm : radius.lg, borderBottomRightRadius: mine && sameNewer ? radius.sm : radius.lg,
            borderTopLeftRadius: !mine && sameOlder ? radius.sm : radius.lg, borderBottomLeftRadius: !mine && sameNewer ? radius.sm : radius.lg,
          }]}>
          {mine && <LinearGradient pointerEvents="none" colors={[colors.bubbleMineStart, colors.bubbleMineEnd]} style={StyleSheet.absoluteFill} />}
          {!message.deleted_at && message.reply_to && <ReplyPreview message={message} uid={uid} known={knownReply} onJump={onJump} />}
          {!message.deleted_at && message.kind === 'image' && <ChatImage message={message} uid={uid} onReply={() => onActions(message)} onHeart={()=>onReact(message,'❤️',true)} />}
          {!!text && <Text style={[styles.body, mine && styles.mineText]}>{text}</Text>}
          {link && <LinkCard url={link} couple={message.couple_id} uid={uid} animate={animateArrival} />}
          {message.kind === 'system' && !text && <Text style={styles.body}>System message</Text>}
          <View style={styles.meta}><Text style={[styles.time, mine && styles.mineText]}>{message.pinned_at ? '📌 ' : ''}{message.edited_at && !message.deleted_at ? 'edited · ' : ''}{new Date(message.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</Text>{mine && <Receipt message={message} />}</View>
        </PressableScale>
      </Animated.View></GestureDetector>
      {!message.deleted_at && reactions && <ReactionChips reactions={reactions} uid={uid} animate={animateArrival} onReact={emoji => onReact(message, emoji)} />}
      {mine && message.status === 'failed' && <PressableScale onPress={() => onRetry(message)} accessibilityRole="button" style={styles.retry}><Text style={styles.errorText}>Couldn’t send · Retry</Text></PressableScale>}
    </View>
  </View>;
}

// Reconciliation replaces only changed messages. Compare quote display fields so
// a receipt update on the quoted original cannot invalidate another bubble.
export const MessageBubble = memo(Bubble, (a, b) => a.message === b.message && a.uid === b.uid && a.partnerName === b.partnerName
  && a.reactions === b.reactions && a.onReact === b.onReact && a.onJump === b.onJump && a.knownReply?.deleted_at === b.knownReply?.deleted_at
  && a.sameOlder === b.sameOlder && a.sameNewer === b.sameNewer && a.showDate === b.showDate && a.highlighted === b.highlighted && a.animateArrival === b.animateArrival
  && a.knownReply?.id === b.knownReply?.id && a.knownReply?.body === b.knownReply?.body && a.knownReply?.kind === b.knownReply?.kind
  && a.knownReply?.sender_id === b.knownReply?.sender_id && a.onReply === b.onReply && a.onActions === b.onActions && a.onRetry === b.onRetry && a.claimEntrance === b.claimEntrance);

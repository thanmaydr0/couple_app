import { Text, View } from 'react-native';
import { PressableScale } from '@/motion';
import { useTheme } from '@/theme';
import { ChatReveal } from './ChatReveal';
import type { Reaction } from './types';
export function validReaction(value: string): boolean {
  return value.length<=32 && (/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|[\u200d\ufe0f])+$/u.test(value) || /^[0-9#*]\ufe0f?\u20e3$/u.test(value));
}
export function ReactionChips({ reactions, uid, animate, onReact }: { reactions: Reaction[]; uid: string; animate: boolean; onReact: (emoji: string) => void }) {
  const { colors, spacing, radius, typography, geometry } = useTheme();
  const counts = new Map<string, number>();
  for (const reaction of reactions) counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{[...counts].map(([emoji, count]) => {
    const chip = <PressableScale accessibilityRole="button" accessibilityLabel={`${emoji}, ${count} reaction${count === 1 ? '' : 's'}`} accessibilityState={{ selected: reactions.some(r => r.user_id === uid && r.emoji === emoji) }} onPress={() => onReact(emoji)}
      style={{ minHeight: geometry.touch, paddingHorizontal: spacing.s12, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: reactions.some(r => r.user_id === uid && r.emoji === emoji) ? colors.primary : colors.surfaceAlt }}>
      <Text style={{ ...typography.label, color: reactions.some(r => r.user_id === uid && r.emoji === emoji) ? colors.primaryContrast : colors.textPrimary }}>{emoji} {count}</Text></PressableScale>;
    return animate ? <ChatReveal key={`${emoji}:${count}`}>{chip}</ChatReveal> : <View key={emoji}>{chip}</View>;
  })}</View>;
}

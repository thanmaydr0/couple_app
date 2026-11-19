import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/motion';
import { useTheme } from '@/theme';
import { ChatReveal } from './ChatReveal';
import type { Reaction } from './types';

export function validReaction(value: string): boolean {
  return (
    value.length <= 32 &&
    (/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|[\u200d\ufe0f])+$/u.test(
      value
    ) ||
      /^[0-9#*]\ufe0f?\u20e3$/u.test(value))
  );
}

export function ReactionChips({
  reactions,
  uid,
  animate,
  onReact,
}: {
  reactions: Reaction[];
  uid: string;
  animate: boolean;
  onReact: (emoji: string) => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const counts = new Map<string, number>();
  for (const reaction of reactions) {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  }

  return (
    <View style={styles.container}>
      {[...counts].map(([emoji, count]) => {
        const hasReacted = reactions.some(r => r.user_id === uid && r.emoji === emoji);
        const chip = (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${emoji}, ${count} reaction${count === 1 ? '' : 's'}`}
            accessibilityState={{ selected: hasReacted }}
            onPress={() => onReact(emoji)}
            style={[
              styles.chip,
              {
                borderRadius: radius.pill,
                backgroundColor: hasReacted ? colors.primary : colors.bgElevated,
                borderColor: hasReacted ? colors.primary : colors.border,
                shadowColor: colors.shadowColor,
              },
            ]}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
            {count > 1 && (
              <Text
                style={[
                  styles.countText,
                  {
                    color: hasReacted ? colors.primaryContrast : colors.textPrimary,
                  },
                ]}
              >
                {count}
              </Text>
            )}
          </PressableScale>
        );

        return animate ? (
          <ChatReveal key={`${emoji}:${count}`}>{chip}</ChatReveal>
        ) : (
          <View key={emoji}>{chip}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minHeight: 26,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emojiText: {
    fontSize: 14,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});

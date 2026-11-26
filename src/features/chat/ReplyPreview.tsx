import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import { useChatStyles } from './styles';
import type { ChatMessage } from './model';
import { bodySummary, projectMessage } from './body';
import type { ChatRow } from './types';
import { PressableScale } from '@/motion';

export function ReplyPreview({
  message,
  uid,
  known,
  onJump,
}: {
  message: ChatMessage;
  uid: string;
  known: ChatMessage | undefined;
  onJump: (id: string) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useChatStyles();
  const reply = useQuery({
    queryKey: ['chat-reply', uid, message.couple_id, message.reply_to],
    enabled: !!message.reply_to && !known,
    staleTime: 30_000,
    queryFn: async () => {
      if (!message.reply_to) return null;
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('couple_id', message.couple_id)
        .eq('id', message.reply_to)
        .maybeSingle();
      if (error) throw error;
      return data ? projectMessage(data as ChatRow) : null;
    },
  });
  const original = known ?? reply.data;
  const mine = message.sender_id === uid;

  return (
    <PressableScale
      sheen={false}
      accessibilityRole="button"
      accessibilityLabel="Jump to replied message"
      onPress={() => {
        if (message.reply_to) onJump(message.reply_to);
      }}
      style={[
        styles.quote,
        {
          minHeight: 34,
          borderLeftColor: mine ? colors.bubbleMineText : colors.primary,
          backgroundColor: mine
            ? 'rgba(255,255,255,0.12)'
            : dark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.04)',
        },
      ]}
    >
      <Text style={[styles.quoteName, mine && styles.mineText]}>
        {original?.sender_id === uid ? 'You' : 'Partner'}
      </Text>
      <Text style={[styles.quoteText, !mine && { color: colors.bubbleTheirsText }]} numberOfLines={2}>
        {original ? bodySummary(original) : 'Earlier message'}
      </Text>
    </PressableScale>
  );
}

import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import { useChatStyles } from './styles';
import type { ChatMessage } from './model';
export function ReplyPreview({ message, uid, known }: { message: ChatMessage; uid: string; known: ChatMessage | undefined }) {
  const { colors } = useTheme();
  const styles = useChatStyles();
  const reply = useQuery({
    queryKey: ['chat-reply', uid, message.couple_id, message.reply_to],
    enabled: !!message.reply_to && !known,
    staleTime: Infinity,
    queryFn: async () => {
      if (!message.reply_to) return null;
      const { data, error } = await supabase.from('messages').select('*').eq('couple_id', message.couple_id).eq('id', message.reply_to).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const original = known ?? reply.data;
  const mine = message.sender_id === uid;
  return <View style={[styles.quote, !mine && { borderLeftColor: colors.primary }]}><Text style={[styles.quoteName, mine && styles.mineText]}>{original?.sender_id === uid ? 'You' : 'Partner'}</Text>
    <Text style={[styles.quoteText, !mine && { color: colors.bubbleTheirsText }]} numberOfLines={2}>{original ? (original.kind === 'image' ? '📷 Photo' : original.body) : 'Earlier message'}</Text></View>;
}

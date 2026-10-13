import { Linking, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { PressableScale } from '@/motion';
import { supabase } from '@/lib/supabase';
import { ChatReveal } from './ChatReveal';
import type { LinkPreview } from './types';
export function LinkCard({ url, couple, uid, animate }: { url: string; couple: string; uid: string; animate: boolean }) {
  const { colors, spacing, radius, typography, geometry } = useTheme();
  const query = useQuery({ queryKey: ['chat-link', uid, couple, url], staleTime: 7 * 86400000, retry: false, queryFn: async () => {
    const result = await supabase.functions.invoke<LinkPreview>('link-preview', { body: { url } });
    if (result.error || !result.data) throw result.error ?? new Error('Preview unavailable');
    return result.data;
  } });
  const card = <View style={{ padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.sm }}>
    {query.data?.image && <Image source={{ uri: query.data.image }} contentFit="cover" style={{ height: geometry.touch * 2, borderRadius: radius.sm }} />}
    <PressableScale accessibilityRole="link" onPress={() => { void Linking.openURL(url).catch(() => {}); }} style={{ justifyContent: 'center' }}>
      <Text numberOfLines={2} style={{ ...typography.label, color: colors.textPrimary }}>{query.data?.title || new URL(url).hostname}</Text>
      {!!query.data?.description && <Text numberOfLines={2} style={{ ...typography['body/S'], color: colors.textSecondary }}>{query.data.description}</Text>}
    </PressableScale>
    {query.isPending && <Text style={{ ...typography.caption, color: colors.textSecondary }}>Loading preview…</Text>}
    {query.isError && <PressableScale onPress={() => void query.refetch()}><Text style={{ ...typography.caption, color: colors.textSecondary }}>Preview unavailable · retry when online</Text></PressableScale>}
  </View>;
  return animate ? <ChatReveal>{card}</ChatReveal> : card;
}

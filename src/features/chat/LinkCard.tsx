import { Linking, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme';
import { PressableScale } from '@/motion';
import { ChatReveal } from './ChatReveal';
import { cachedLinkPreview } from './body';

export function LinkCard({
  url,
  couple,
  uid,
  animate,
}: {
  url: string;
  couple: string;
  uid: string;
  animate: boolean;
}) {
  const { colors, surfaces, spacing, radius, typography, geometry } = useTheme();
  const query = useQuery({
    queryKey: ['chat-link', uid, couple, url],
    staleTime: 7 * 86400000,
    retry: false,
    queryFn: async () => {
      return cachedLinkPreview(url) ?? { url, title: new URL(url).hostname, description: '', image: null };
    },
  });

  const card = (
    <View
      style={{
        padding: spacing.sm,
        gap: spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: surfaces.rim,
      }}
    >
      {query.data?.image && (
        <Image
          source={{ uri: query.data.image }}
          contentFit="cover"
          style={{ height: geometry.touch * 2, borderRadius: radius.sm }}
        />
      )}
      <PressableScale
        sheen={false}
        accessibilityRole="link"
        onPress={() => {
          void Linking.openURL(url).catch(() => {});
        }}
        style={{ justifyContent: 'center', minHeight: 34 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="link-outline" size={14} color={colors.primary} />
          <Text numberOfLines={2} style={{ ...typography.label, color: colors.textPrimary, flex: 1 }}>
            {query.data?.title || new URL(url).hostname}
          </Text>
        </View>
        {!!query.data?.description && (
          <Text numberOfLines={2} style={{ ...typography['body/S'], color: colors.textSecondary, marginTop: 2 }}>
            {query.data.description}
          </Text>
        )}
      </PressableScale>
      {query.isPending && (
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>Loading preview…</Text>
      )}
      {query.isError && (
        <PressableScale sheen={false} onPress={() => void query.refetch()} style={{ minHeight: 28 }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            Preview unavailable · retry when online
          </Text>
        </PressableScale>
      )}
    </View>
  );

  return animate ? <ChatReveal>{card}</ChatReveal> : card;
}

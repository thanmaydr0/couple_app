import { useEffect, useState, type ComponentProps } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useNetInfo } from '@react-native-community/netinfo';
import { router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { differenceInCalendarDays, formatDistanceToNow, parseISO } from 'date-fns';
import { useAvatar, useCouple, usePartner } from '@/lib/hooks';
import { usePresence } from '@/features/presence/PresenceProvider';
import { Avatar, Card, IconButton, Screen, Text, ErrorState, PressableScale } from '@/ui';
import { useTheme } from '@/theme';
import { FadeInView, ParallaxHeader, PulseRing, Skeleton } from '@/motion';
import { DaysCounter, FailureToast, OfflineNotice, PageSkeleton } from '@/features/presence/Presentation';
import { RecentCalls } from '@/features/calls/RecentCalls';
import { MoreOfUs, HomeCards } from '@/features/shared/FeatureSlots';

const destinations: {
  title: string;
  detail: string;
  href: Href;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  { title: 'Chat', detail: 'Every little thought', href: '/(tabs)/chat', icon: 'chatbubble-ellipses-outline' },
  { title: 'Memories', detail: 'Kept together', href: '/(tabs)/memories', icon: 'images-outline' },
  { title: 'Watch', detail: 'Movies & YouTube', href: '/(tabs)/watch', icon: 'play-circle-outline' },
  { title: 'Games', detail: 'Playful moments', href: '/(tabs)/games', icon: 'game-controller-outline' },
];

export default function HomeScreen() {
  const { colors, surfaces, spacing, geometry, radius } = useTheme();
  const network = useNetInfo();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  const partner = usePartner();
  const couple = useCouple();
  const avatar = useAvatar(partner.data?.avatar_path);
  const online = usePresence(state => state.partnerOnline);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (partner.isPending || couple.isPending) return <PageSkeleton title="Our space" />;
  if (partner.isError || couple.isError) {
    return (
      <Screen atmosphere>
        <OfflineNotice />
        <FailureToast message="We couldn’t load your home. Check your connection." />
        <ErrorState
          title="Your space couldn’t load"
          description="Check your connection and try again."
          onRetry={() => {
            void partner.refetch();
            void couple.refetch();
          }}
        />
      </Screen>
    );
  }

  const name = partner.data?.display_name || 'Your partner';
  const lastSeen = partner.data?.last_seen ? parseISO(partner.data.last_seen) : null;
  const status = offline
    ? 'Offline view'
    : online
    ? 'Online now'
    : lastSeen && !Number.isNaN(lastSeen.getTime())
    ? `Active ${formatDistanceToNow(new Date(Math.min(lastSeen.getTime(), now)), { addSuffix: true })}`
    : 'Nearby in spirit';
  const anniversary = couple.data?.anniversary ? parseISO(couple.data.anniversary) : null;
  const days =
    anniversary && !Number.isNaN(anniversary.getTime())
      ? Math.max(0, differenceInCalendarDays(new Date(now), anniversary))
      : null;

  return (
    <Screen atmosphere>
      <Animated.ScrollView
        onScroll={onScroll}
        contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.s56 + spacing.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={partner.isRefetching || couple.isRefetching}
            onRefresh={() => {
              void partner.refetch();
              void couple.refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ParallaxHeader scrollY={scrollY}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.xs }}>
            <View style={{ gap: 2 }}>
              <Text variant="caption" color="textMuted" style={{ letterSpacing: 1.2 }}>
                JUST THE TWO OF YOU
              </Text>
              <Text variant="display/M" accessibilityRole="header">
                Our space
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <IconButton name="grid-outline" accessibilityLabel="Open all features" onPress={() => router.push('/us')} />
              <IconButton name="settings-outline" accessibilityLabel="Open settings" onPress={() => router.push('/settings')} />
            </View>
          </View>
        </ParallaxHeader>

        <OfflineNotice />
        {(partner.isRefetching || couple.isRefetching) && <Skeleton height={geometry.track} />}

        {/* Partner Hero Sanctuary */}
        <FadeInView>
          <Card variant="elevated" style={{ gap: spacing.md, padding: spacing.s20 }}>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              {online && !offline ? (
                <PulseRing size={68}>
                  <Avatar name={name} uri={avatar.data} size={56} />
                </PulseRing>
              ) : (
                <Avatar name={name} uri={avatar.data} size={58} />
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="title/L" numberOfLines={1}>
                  {name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: online && !offline ? colors.success : colors.textMuted,
                    }}
                  />
                  <Text variant="body/S" color={online && !offline ? 'success' : 'textSecondary'}>
                    {status}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: 2 }}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Voice call"
                onPress={() => router.push({ pathname: '/call', params: { kind: 'audio' } })}
                style={{
                  flex: 1,
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  backgroundColor: colors.primary,
                  borderRadius: radius.pill,
                  paddingHorizontal: spacing.md,
                }}
              >
                <Ionicons name="call" size={17} color={colors.primaryContrast} />
                <Text variant="label" color="primaryContrast">
                  Voice
                </Text>
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Video call"
                onPress={() => router.push({ pathname: '/call', params: { kind: 'video' } })}
                style={{
                  flex: 1,
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: surfaces.rimStrong,
                  borderRadius: radius.pill,
                  paddingHorizontal: spacing.md,
                }}
              >
                <Ionicons name="videocam" size={18} color={colors.textPrimary} />
                <Text variant="label" color="textPrimary">
                  Video
                </Text>
              </PressableScale>
            </View>
          </Card>
        </FadeInView>

        {/* Minimal Typographic Days Together Showcase */}
        {days !== null && (
          <FadeInView delay={60} style={{ alignItems: 'center', paddingVertical: spacing.sm, gap: 4 }}>
            <DaysCounter value={days} />
            <Text variant="label" color="primary" style={{ letterSpacing: 0.6 }}>
              DAYS TOGETHER ♥
            </Text>
            <Text variant="caption" color="textMuted">
              Every chapter, side by side
            </Text>
          </FadeInView>
        )}

        {/* Quick Actions 2x2 Grid */}
        <FadeInView delay={110} style={{ gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="title/M" accessibilityRole="header">
              Spaces for two
            </Text>
            <PressableScale
              sheen={false}
              accessibilityRole="button"
              accessibilityLabel="Explore all features"
              onPress={() => router.push('/us')}
              style={{ minHeight: 34, paddingHorizontal: 10, justifyContent: 'center' }}
            >
              <Text variant="label" color="primary">
                All features →
              </Text>
            </PressableScale>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 }}>
            {destinations.map(({ title, detail, href, icon }) => (
              <PressableScale
                key={title}
                accessibilityRole="button"
                accessibilityLabel={`Open ${title}`}
                onPress={() => router.push(href)}
                style={{ flexBasis: '47%', flexGrow: 1 }}
              >
                <Card
                  variant="elevated"
                  style={{
                    minHeight: 108,
                    padding: spacing.md,
                    justifyContent: 'space-between',
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.md,
                        backgroundColor: surfaces.softPrimary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={icon} size={20} color={colors.primary} />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text variant="title/S">{title}</Text>
                    <Text variant="caption" color="textSecondary" numberOfLines={1}>
                      {detail}
                    </Text>
                  </View>
                </Card>
              </PressableScale>
            ))}
          </View>
        </FadeInView>

        <MoreOfUs />
        <HomeCards />

        <View style={{ paddingTop: spacing.xs }}>
          <RecentCalls limit={3} />
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

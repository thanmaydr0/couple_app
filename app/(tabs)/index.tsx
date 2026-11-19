import { useEffect, useState, type ComponentProps } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useNetInfo } from '@react-native-community/netinfo';
import { router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { differenceInCalendarDays, formatDistanceToNow, parseISO } from 'date-fns';
import { useAvatar, useCouple, usePartner } from '@/lib/hooks';
import { usePresence } from '@/features/presence/PresenceProvider';
import { Avatar, Button, Card, IconButton, Screen, Text, Header, ErrorState, PressableScale } from '@/ui';
import { useTheme } from '@/theme';
import { ParallaxHeader, PulseRing, StaggerList, Skeleton } from '@/motion';
import { DaysCounter, FailureToast, OfflineNotice, PageSkeleton } from '@/features/presence/Presentation';
import { RecentCalls } from '@/features/calls/RecentCalls';
import { MoreOfUs, HomeCards } from '@/features/shared/FeatureSlots';
const destinations: { title: string; detail: string; href: Href; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { title: 'Chat', detail: 'The little things, all day long', href: '/(tabs)/chat', icon: 'chatbubbles-outline' },
  { title: 'Memories', detail: 'Your favorite moments, kept close', href: '/(tabs)/memories', icon: 'images-outline' },
  { title: 'Watch together', detail: 'One movie. Two cozy corners.', href: '/(tabs)/watch', icon: 'play-circle-outline' },
  { title: 'Games', detail: 'A little friendly competition', href: '/(tabs)/games', icon: 'game-controller-outline' },
];
export default function HomeScreen() {
  const { colors, spacing, geometry, radius } = useTheme();
  const network = useNetInfo();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(event => { scrollY.value = event.contentOffset.y; });
  const partner = usePartner();
  const couple = useCouple();
  const avatar = useAvatar(partner.data?.avatar_path);
  const online = usePresence((state) => state.partnerOnline);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  if (partner.isPending || couple.isPending) return <PageSkeleton title="Our space" />;
  if (partner.isError || couple.isError) return <Screen><Header title="Our space" /><OfflineNotice /><FailureToast message="We couldn’t load your home. Check your connection." /><ErrorState title="Your space couldn’t load" description="Check your connection and try again." onRetry={() => { void partner.refetch(); void couple.refetch(); }} /></Screen>;
  const name = partner.data?.display_name || 'Your partner';
  const lastSeen = partner.data?.last_seen ? parseISO(partner.data.last_seen) : null;
  const status = offline ? 'Live status unavailable offline' : online ? 'Online' : lastSeen && !Number.isNaN(lastSeen.getTime()) ? `Last seen ${formatDistanceToNow(new Date(Math.min(lastSeen.getTime(), now)), { addSuffix: true })}` : 'Last seen unavailable';
  const anniversary = couple.data?.anniversary ? parseISO(couple.data.anniversary) : null;
  const days = anniversary && !Number.isNaN(anniversary.getTime()) ? Math.max(0, differenceInCalendarDays(new Date(now), anniversary)) : null;
  return <Screen atmosphere gradient><Animated.ScrollView onScroll={onScroll} contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}
    refreshControl={<RefreshControl refreshing={partner.isRefetching || couple.isRefetching} onRefresh={() => { void partner.refetch(); void couple.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surface} />}>
    <ParallaxHeader scrollY={scrollY}><Text variant="caption" color="textSecondary">JUST THE TWO OF YOU</Text><Header title="Our space" right={<View style={{ flexDirection: 'row', gap: spacing.sm }}><IconButton name="grid-outline" accessibilityLabel="Open all features" onPress={() => router.push('/us')} /><IconButton name="settings-outline" accessibilityLabel="Open settings" onPress={() => router.push('/settings')} /></View>} /></ParallaxHeader>
    <OfflineNotice />
    {(partner.isRefetching || couple.isRefetching) && <Skeleton height={geometry.track} />}
    <Card variant="elevated" style={{ gap: spacing.md, padding: spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        {online && !offline ? <PulseRing size={spacing.s56}><Avatar name={name} uri={avatar.data} size={geometry.avatar} /></PulseRing> : <Avatar name={name} uri={avatar.data} size={spacing.s56} />}
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="title/L">{name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            {online && !offline && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />}
            <Text variant="body/S" color={online && !offline ? 'success' : 'textSecondary'}>{status}</Text>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs }}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Voice call" onPress={() => router.push({ pathname: '/call', params: { kind: 'audio' } })} style={{ flex: 1, minHeight: geometry.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.md }}>
          <Ionicons name="call" size={18} color={colors.primaryContrast} />
          <Text variant="label" color="primaryContrast">Voice call</Text>
        </PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel="Video call" onPress={() => router.push({ pathname: '/call', params: { kind: 'video' } })} style={{ flex: 1, minHeight: geometry.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderWidth: geometry.hairline, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md }}>
          <Ionicons name="videocam" size={18} color={colors.textPrimary} />
          <Text variant="label" color="textPrimary">Video call</Text>
        </PressableScale>
      </View>
    </Card>
    {days !== null && <Card variant="elevated" style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg }}>
      <DaysCounter value={days} />
      <Text variant="label" color="primary">days together ♥</Text>
      <Text variant="caption" color="textSecondary">Every day with you is my favorite</Text>
    </Card>}
    <View style={{ gap: spacing.sm }}>
      <Text variant="title/M" accessibilityRole="header">Moments for two</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 }}>
        {destinations.map(({ title, detail, href, icon }) => (
          <PressableScale key={title} accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={() => router.push(href)} style={{ flexBasis: '47%', flexGrow: 1 }}>
            <Card variant="elevated" style={{ minHeight: geometry.touch * 2.2, padding: spacing.md, justifyContent: 'space-between', gap: spacing.sm }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon} size={22} color={colors.primary} />
              </View>
              <View style={{ gap: 2 }}>
                <Text variant="title/S">{title}</Text>
                <Text variant="caption" color="textSecondary" numberOfLines={2}>{detail}</Text>
              </View>
            </Card>
          </PressableScale>
        ))}
      </View>
      <PressableScale accessibilityRole="button" accessibilityLabel="Explore all features" onPress={() => router.push('/us')}>
        <Card variant="flat" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, marginTop: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="grid-outline" size={geometry.icon} color={colors.primary} />
            <Text variant="label">All features · Explore your space</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Card>
      </PressableScale>
    </View>
    <MoreOfUs /><HomeCards />
    <RecentCalls />
  </Animated.ScrollView></Screen>;
}

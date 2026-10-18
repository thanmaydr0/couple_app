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
  const { colors, spacing, geometry } = useTheme();
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
  return <Screen gradient><Animated.ScrollView onScroll={onScroll} contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}
    refreshControl={<RefreshControl refreshing={partner.isRefetching || couple.isRefetching} onRefresh={() => { void partner.refetch(); void couple.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surface} />}>
    <ParallaxHeader scrollY={scrollY}><Text variant="caption" color="textSecondary">JUST THE TWO OF YOU</Text><Header title="Our space" right={<View style={{ flexDirection: 'row', gap: spacing.sm }}><IconButton name="grid-outline" accessibilityLabel="Open all features" onPress={() => router.push('/us')} /><IconButton name="settings-outline" accessibilityLabel="Open settings" onPress={() => router.push('/settings')} /></View>} /></ParallaxHeader>
    <OfflineNotice />
    <Button title="All features · explore your space" variant="secondary" onPress={() => router.push('/us')} />
    {(partner.isRefetching || couple.isRefetching) && <Skeleton height={geometry.track} />}
    <Card style={{ gap: spacing.s20 }}><View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
      {online && !offline ? <PulseRing size={spacing.s56}><Avatar name={name} uri={avatar.data} size={geometry.avatar} /></PulseRing> : <Avatar name={name} uri={avatar.data} size={spacing.s56} />}
      <View style={{ flex: 1, gap: spacing.xs }}><Text variant="title/M">{name}</Text><Text variant="body/S" color={online && !offline ? 'success' : 'textSecondary'}>{status}</Text></View>
    </View><View style={{ flexDirection: 'row', gap: spacing.s12, flexWrap: 'wrap' }}>
      <Button title="Voice call" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/call', params: { kind: 'audio' } })} />
      <Button title="Video call" variant="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/call', params: { kind: 'video' } })} />
    </View></Card>
    {days !== null && <Card style={{ alignItems: 'center', gap: spacing.sm }}><DaysCounter value={days} /><Text>days together ♥</Text></Card>}
    <StaggerList style={{ gap: spacing.s12 }}>{destinations.map(({ title, detail, href, icon }) => <PressableScale key={title} accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={() => router.push(href)}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: geometry.touch * 2 }}><Ionicons name={icon} size={geometry.icon} color={colors.primary} /><View style={{ flex: 1, gap: spacing.xs }}><Text variant="title/S">{title}</Text><Text variant="body/S" color="textSecondary">{detail}</Text></View><Ionicons name="chevron-forward" size={geometry.icon} color={colors.textSecondary} /></Card>
    </PressableScale>)}</StaggerList>
    <MoreOfUs /><HomeCards />
    <RecentCalls />
  </Animated.ScrollView></Screen>;
}

import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { differenceInCalendarDays, formatDistanceToNow, parseISO } from 'date-fns';
import { useAvatar, useCouple, usePartner } from '@/lib/hooks';
import { usePresence } from '@/features/presence/PresenceProvider';
import { Avatar, Button, Card, IconButton, Screen, Text, theme } from '@/ui';
import { LoadingScreen } from '@/ui/LoadingScreen';
const destinations: { title: string; detail: string; href: Href; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { title: 'Chat', detail: 'The little things, all day long', href: '/(tabs)/chat', icon: 'chatbubbles-outline' },
  { title: 'Memories', detail: 'Your favorite moments, kept close', href: '/(tabs)/memories', icon: 'images-outline' },
  { title: 'Watch together', detail: 'One movie. Two cozy corners.', href: '/(tabs)/watch', icon: 'play-circle-outline' },
  { title: 'Games', detail: 'A little friendly competition', href: '/(tabs)/games', icon: 'game-controller-outline' },
];
export default function HomeScreen() {
  const partner = usePartner();
  const couple = useCouple();
  const avatar = useAvatar(partner.data?.avatar_path);
  const online = usePresence((state) => state.partnerOnline);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  if (partner.isPending || couple.isPending) return <LoadingScreen />;
  if (partner.isError || couple.isError) return <Screen centered><Text>We couldn’t load your home. Check your connection.</Text><Button title="Try again" onPress={() => { void partner.refetch(); void couple.refetch(); }} /></Screen>;
  const name = partner.data?.display_name || 'Your partner';
  const lastSeen = partner.data?.last_seen ? parseISO(partner.data.last_seen) : null;
  const status = online ? 'Online' : lastSeen && !Number.isNaN(lastSeen.getTime()) ? `Last seen ${formatDistanceToNow(new Date(Math.min(lastSeen.getTime(), now)), { addSuffix: true })}` : 'Last seen unavailable';
  const anniversary = couple.data?.anniversary ? parseISO(couple.data.anniversary) : null;
  const days = anniversary && !Number.isNaN(anniversary.getTime()) ? Math.max(0, differenceInCalendarDays(new Date(now), anniversary)) : null;
  return <Screen><ScrollView contentContainerStyle={{ gap: 24, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View><Text style={{ color: theme.colors.muted }}>JUST THE TWO OF YOU</Text><Text accessibilityRole="header" style={{ fontSize: 34, lineHeight: 44, fontWeight: '700' }}>Our space</Text></View>
      <IconButton name="settings-outline" accessibilityLabel="Open settings" onPress={() => router.push('/settings')} />
    </View>
    <Card style={{ gap: 20 }}><View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
      <Avatar name={name} uri={avatar.data} size={72} /><View style={{ flex: 1 }}><Text style={{ fontSize: 24, lineHeight: 32, fontWeight: '600' }}>{name}</Text><Text style={{ color: online ? theme.colors.success : theme.colors.muted }}>{status}</Text></View>
    </View><View style={{ flexDirection: 'row', gap: 12 }}>
      <Button title="Voice call" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/call', params: { kind: 'audio' } })} />
      <Button title="Video call" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/call', params: { kind: 'video' } })} />
    </View></Card>
    {days !== null && <Card style={{ alignItems: 'center', gap: 8 }}><Text style={{ fontSize: 40, lineHeight: 48, color: theme.colors.primary, fontWeight: '700' }}>{days.toLocaleString()}</Text><Text>days together ♥</Text></Card>}
    {destinations.map(({ title, detail, href, icon }) => <Pressable key={title} accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={() => router.push(href)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 108 }}><Ionicons name={icon} size={32} color={theme.colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontSize: 20, fontWeight: '600' }}>{title}</Text><Text style={{ color: theme.colors.muted, marginTop: 4 }}>{detail}</Text></View><Ionicons name="chevron-forward" size={20} color={theme.colors.muted} /></Card>
    </Pressable>)}
  </ScrollView></Screen>;
}

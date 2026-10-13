import { VoicePlayer } from '@/features/voice';
import { useEffect, useRef, useState } from 'react';
import { AppState, Image, ScrollView, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { Burst, FadeInView, motionTokens, PulseRing, useMotion } from '@/motion';
import { Button, Card, Header, PressableScale, Screen, Text } from '@/ui';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/hooks';
import { capsuleTiming, holdCapsule, readCapsule } from './service';
import type { Capsule } from './types';
import { decryptedFile } from '@/features/e2ee/files';

export function WaxSeal({ cracked = false, ready = false }: { cracked?: boolean; ready?: boolean }) {
  const { colors, spacing, geometry } = useTheme();
  const motion = useMotion(); const crack = useSharedValue(0);
  useEffect(() => { crack.value = withTiming(cracked ? 1 : 0, { duration: motion.duration('base') }); }, [cracked, crack, motion.level]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${motion.level === 'full' ? crack.value * motionTokens.travel : 0}deg` }] }));
  const size = spacing.s56; const center = size / 2;
  return <PulseRing size={size}><Animated.View style={style}><Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <Circle cx={center} cy={center} r={center - geometry.stroke} fill={colors.primary} />
    <Circle cx={center} cy={center} r={center - spacing.sm} stroke={colors.primaryContrast} strokeWidth={geometry.hairline} fill="none" strokeDasharray={ready ? undefined : `${spacing.sm} ${spacing.xs}`} />
    <Path d={`M ${center - spacing.sm} ${center} L ${center} ${center + spacing.sm} L ${center + spacing.sm} ${center - spacing.xs}`} stroke={colors.primaryContrast} strokeWidth={geometry.stroke} fill="none" />
    {cracked && <Path d={`M ${center} 0 L ${center - spacing.xs} ${center - spacing.sm} L ${center + spacing.xs} ${center} L ${center - spacing.xs} ${center + spacing.sm} L ${center} ${size}`} stroke={colors.surface} strokeWidth={geometry.stroke} fill="none" />}
  </Svg></Animated.View></PulseRing>;
}
function Envelope({ opening }: { opening: boolean }) {
  const { colors, geometry, spacing } = useTheme(); const motion = useMotion(); const flap = useSharedValue(0);
  useEffect(() => { flap.value = withTiming(opening ? 1 : 0, { duration: motion.duration('hero') }); }, [opening, flap, motion.level]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - flap.value, transform: [{ translateY: motion.level === 'full' ? -flap.value * spacing.xl : 0 }, { rotateX: `${motion.level === 'full' ? flap.value * 90 : 0}deg` }] }));
  const width = geometry.touch * 4; const height = geometry.touch * 2;
  return <Animated.View importantForAccessibility="no-hide-descendants" style={[{ alignSelf: 'center', height: opening ? spacing.s56 : height }, style]}><Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}><Path d={`M 0 0 H ${width} V ${height} H 0 Z`} fill={colors.surfaceAlt} stroke={colors.border} strokeWidth={geometry.stroke} /><Path d={`M 0 0 L ${width / 2} ${height / 2} L ${width} 0`} fill="none" stroke={colors.primary} strokeWidth={geometry.stroke} /></Svg></Animated.View>;
}
function CapsulePhoto({ path, encrypted }: { path: string; encrypted?: boolean }) {
  const { spacing, geometry, radius } = useTheme(); const { data: session } = useSession();
  const query = useQuery({ queryKey: ['capsule-photo', session?.user.id, path], staleTime: 0,
    queryFn: async () => { if (encrypted) return decryptedFile(path, 'capsules'); const result = await supabase.storage.from('capsules').createSignedUrl(path, 120); if (result.error) throw result.error; return result.data.signedUrl; } });
  return <FadeInView style={{ marginTop: spacing.md }}>{query.data ? <Image accessibilityLabel="A photo inside your capsule" source={{ uri: query.data }} resizeMode="contain" style={{ width: '100%', height: geometry.touch * 5, borderRadius: radius.md }} /> : <Text>{query.isError ? 'Photo unavailable' : 'Loading photo…'}</Text>}{query.isError && <Button title="Retry photo" onPress={() => { void query.refetch(); }} />}</FadeInView>;
}
function Paper({ capsule }: { capsule: Capsule }) {
  const { spacing } = useTheme(); const motion = useMotion(); const unfold = useSharedValue(0); const [letters, setLetters] = useState(0);
  useEffect(() => { unfold.value = withTiming(1, { duration: motion.duration('hero') }); }, [unfold, motion.level]);
  useEffect(() => {
    if (motion.level !== 'full') { setLetters(capsule.body.length); return; }
    setLetters(0); let revealed = 0;
    const timer = setInterval(() => { revealed = Math.min(capsule.body.length, revealed + Math.max(1, Math.ceil(capsule.body.length / 100))); setLetters(revealed); if (revealed >= capsule.body.length) clearInterval(timer); }, motionTokens.fast / 4);
    return () => clearInterval(timer);
  }, [capsule.body, motion.level]);
  const style = useAnimatedStyle(() => ({ opacity: unfold.value, transform: [{ scaleY: motion.level === 'full' ? 0.5 + unfold.value / 2 : 1 }] }));
  return <Animated.View style={style}><Card style={{ gap: spacing.md }}><Text variant="title/L">{capsule.title || 'A letter for you'}</Text><Text accessibilityLabel={capsule.body}>{capsule.body.slice(0, letters)}</Text>{capsule.media_paths.map(path => <CapsulePhoto key={path} path={path} encrypted={capsule.encrypted} />)}{capsule.voice_path && <VoicePlayer id={capsule.id} path={capsule.voice_path} bucket="capsules" encrypted={capsule.encrypted} meta={capsule.voiceMeta} />}</Card></Animated.View>;
}
export function Ceremony({ id, together, onClose }: { id: string; together: boolean; onClose: () => void }) {
  const { spacing, colors, radius } = useTheme(); const motion = useMotion(); const { data: session } = useSession();
  const [peer, setPeer] = useState(false); const [holding, setHolding] = useState(false); const [opened, setOpened] = useState<Capsule | null>(null); const [error, setError] = useState(''); const [cracked, setCracked] = useState(false);
  const hold = useRef(false); const peerRef = useRef(false); const openedRef = useRef(false);
  const motionLevel = useRef(motion.level); motionLevel.current = motion.level;
  useEffect(() => {
    if (!session) return;
    let active = AppState.currentState === 'active'; let alive = true; let busy = false; let beat = 0;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const updatePeer = () => {
      const present = !!channel && Object.keys(channel.presenceState()).some(key => key !== session.user.id);
      peerRef.current = present; setPeer(present);
    };
    const connect = () => {
      channel = supabase.channel(`capsule-ceremony:${id}`, { config: { presence: { key: session.user.id } } });
      channel.on('presence', { event: 'sync' }, updatePeer).subscribe(status => {
        if (status === 'SUBSCRIBED' && active) void channel?.track({ ceremony: true });
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('Connection lost. Reconnect to open together.');
      });
    };
    const release = () => { hold.current = false; setHolding(false); setCracked(false); beat = 0; void holdCapsule(id, false).catch(() => {}); };
    const disconnect = () => { release(); peerRef.current = false; setPeer(false); if (channel) void supabase.removeChannel(channel); channel = undefined; };
    if (active) connect();
    const timer = setInterval(() => {
      if (!active || !alive || busy || !hold.current || openedRef.current || (together && !peerRef.current)) return;
      busy = true;
      void holdCapsule(id, true).then(async ready => {
        if (!alive || !active || !hold.current) { await holdCapsule(id, false); return; }
        beat += 1; setCracked(beat > 1);
        if (motionLevel.current === 'full') void Haptics.impactAsync(beat > 1 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        if (ready) {
          const capsule = await readCapsule(id);
          if (!alive || !active) return;
          openedRef.current = true; hold.current = false; setHolding(false); setOpened(capsule);
          if (motionLevel.current === 'full') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          if (channel) void supabase.removeChannel(channel); channel = undefined;
        }
      }).catch(() => { if (alive) { release(); setError('Could not open the seal. Check your connection and try again.'); } }).finally(() => { busy = false; });
    }, capsuleTiming.holdHeartbeat);
    const app = AppState.addEventListener('change', state => { active = state === 'active'; if (!active) disconnect(); else if (!openedRef.current) connect(); });
    return () => { alive = false; hold.current = false; clearInterval(timer); app.remove(); if (channel) void supabase.removeChannel(channel); void holdCapsule(id, false).catch(() => {}); };
  }, [id, together, session?.user.id]);
  const release = () => { hold.current = false; setHolding(false); setCracked(false); void holdCapsule(id, false).catch(() => {}); };
  return <Screen bottomInset><Header title={opened ? 'A moment, kept for you' : 'Break the seal'} onBack={onClose} />
    <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
      {opened ? <><Envelope opening /><Paper capsule={opened} /><View style={{ alignItems: 'center' }}><Burst trigger={1} /></View></> : <>
        <Card style={{ alignItems: 'center', gap: spacing.lg, padding: spacing.xl, borderRadius: radius.sheet }}>
          <Envelope opening={false} /><Text variant="title/M">Something worth the wait</Text>
          <PressableScale accessibilityRole="button" accessibilityLabel={together ? 'Press and hold the wax seal together' : 'Press and hold the wax seal'} accessibilityHint="Hold until the seal opens" haptic={false}
            onPressIn={() => { hold.current = true; setHolding(true); setError(''); }} onPressOut={release}
            style={{ padding: spacing.lg, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill }}><WaxSeal cracked={cracked} ready /></PressableScale>
          <Text style={{ textAlign: 'center' }}>{together ? peer ? holding ? 'Keep holding · waiting for both seals' : 'You’re both here. Hold the seal together.' : 'Waiting for your partner to join this capsule…' : holding ? 'Keep holding…' : 'Press and hold to unfold your letter.'}</Text>
        </Card>
        <Text variant="body/S" color="textSecondary">The server checks the unlock time and both holds. Leaving this screen releases your seal.</Text>
      </>}
      {!!error && <Text color="danger" accessibilityLiveRegion="polite">{error}</Text>}
      <Button title={opened ? 'Back to capsules' : 'Come back later'} onPress={onClose} />
    </ScrollView></Screen>;
}

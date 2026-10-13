import { RingingHealthScreen } from '../ringing/HealthScreen';
import { ScreenShareView } from './ScreenShareView';
import { GoodnightScreen, BedtimeReminder } from './Goodnight';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Animated, PanResponder, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RTCView } from 'react-native-webrtc';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAvatar, usePartner, useSession } from '@/lib/hooks';
import { useTheme } from '@/theme';
import { Screen, Header, Avatar } from '@/ui';
import { PressableScale, FadeInView, PulseRing, HeartbeatView, Skeleton, useMotion } from '@/motion';
import { CallBackdrop, CallChrome, CallDots, CallIcon, useCallStyles } from './presentation';
import { getCallEngine, startCall, useCalls } from './engine';
import { RecentCalls } from './RecentCalls';
import { registerCallNotifications, requestBluetoothRouting } from './notifications';

type IconName = ComponentProps<typeof Ionicons>['name'];
function Control({ icon, label, action, danger, selected }: { icon: IconName; label: string; action: () => void; danger?: boolean; selected?: boolean }) {
  const styles = useCallStyles();
  const [turn, setTurn] = useState(0);
  return <PressableScale accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={label} onPress={() => { if (icon === 'camera-reverse') setTurn(value => value + 1); action(); }} style={styles.controlWrap}>
    <View style={[styles.control, selected && styles.selected, danger && styles.danger]}><CallIcon icon={icon} highlighted={!!danger || !!selected} turn={turn} /></View>
    <Text style={styles.controlLabel}>{label}</Text>
  </PressableScale>;
}
function PartnerAvatar() {
  const styles = useCallStyles();
  const { data: partner } = usePartner();
  const { data: avatar } = useAvatar(partner?.avatar_path);
  return <Avatar name={partner?.display_name ?? 'Your partner'} uri={avatar ?? undefined} size={styles.avatar.width} />;
}
function LocalPreview() {
  const styles = useCallStyles(); const { spacing, geometry, colors } = useTheme(); const motion = useMotion();
  const bounds = { inset: spacing.lg, top: geometry.touch * 3, bottom: geometry.touch * 7, previewWidth: geometry.avatar * 2 + spacing.lg };
  const config = useRef({ bounds, motion }); config.current = { bounds, motion };
  const local = useCalls((s) => s.local);
  const camera = useCalls((s) => s.camera);
  const front = useCalls((s) => s.front);
  const { width, height } = useWindowDimensions();
  const dimensions = useRef({ width, height }); dimensions.current = { width, height };
  const position = useRef(new Animated.ValueXY({ x: spacing.lg, y: geometry.touch * 3 })).current;
  const origin = useRef<{ x: number; y: number }>({ x: spacing.lg, y: geometry.touch * 3 });
  const moved = useRef<{ x: number; y: number }>({ x: spacing.lg, y: geometry.touch * 3 });
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { position.stopAnimation(value => { moved.current = value; origin.current = value; }); origin.current = { ...moved.current }; },
    onPanResponderMove: (_event, gesture) => {
      const { bounds: b } = config.current;
      const x = Math.max(b.inset, Math.min(dimensions.current.width - b.previewWidth - b.inset, origin.current.x + gesture.dx));
      const y = Math.max(b.top, Math.min(dimensions.current.height - b.bottom, origin.current.y + gesture.dy));
      moved.current = { x, y }; position.setValue({ x, y });
    }, onPanResponderRelease: () => {
      const { bounds: b, motion: m } = config.current;
      const right = Math.max(b.inset, dimensions.current.width - b.previewWidth - b.inset);
      const bottom = Math.max(b.top, dimensions.current.height - b.bottom);
      moved.current = { x: moved.current.x < (right + b.inset) / 2 ? b.inset : right, y: moved.current.y < (bottom + b.top) / 2 ? b.top : bottom };
      if (m.level === 'full') Animated.spring(position, { toValue: moved.current, ...m.spring('gentle'), useNativeDriver: false }).start();
      else position.setValue(moved.current);
    }, onPanResponderTerminationRequest: () => false,
  })).current;
  useEffect(() => {
    const { bounds: b } = config.current;
    moved.current = { x: Math.max(b.inset, Math.min(width - b.previewWidth - b.inset, moved.current.x)), y: Math.max(b.top, Math.min(height - b.bottom, moved.current.y)) };
    position.setValue(moved.current);
  }, [width, height, position]);
  return <Animated.View accessibilityLabel="Your camera preview. Drag to move." {...responder.panHandlers}
    style={[styles.preview, { transform: position.getTranslateTransform() }]}>
    {local && camera ? <RTCView streamURL={local.toURL()} objectFit="cover" mirror={front} zOrder={2} style={StyleSheet.absoluteFill} />
      : <Ionicons name="videocam-off-outline" size={geometry.icon} color={colors.textSecondary} />}
    <Text style={styles.previewLabel}>You</Text>
  </Animated.View>;
}

export function ActiveCallScreen() {
  const styles = useCallStyles(); const { colors, spacing, geometry } = useTheme();
  const state = useCalls();
  const [showCamera, setShowCamera] = useState(false);
  const { data: partner } = usePartner();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const engine = getCallEngine();
  const active = ['connecting', 'connected', 'reconnecting'].includes(state.phase);
  const video = state.call?.kind === 'video';
  const elapsed = state.connectedAt ? Math.max(0, Math.floor((now - state.connectedAt) / 1000)) : 0;
  const duration = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
  const status = state.phase === 'incoming' ? 'Incoming call' : state.phase === 'outgoing' ? 'Calling…' : state.phase === 'preparing' ? 'Getting ready…' : state.phase === 'connecting' ? 'Connecting…' : duration;
  const chooseRoute = () => {
    void requestBluetoothRouting().then(() => {
      const available = useCalls.getState().routes;
      const routes = Array.from(new Set(available.length ? available : ['SPEAKER_PHONE', 'EARPIECE']));
      Alert.alert('Audio output', 'Choose where you hear your partner.', routes.map((route) => ({
        text: `${route === 'SPEAKER_PHONE' ? 'Speaker' : route === 'EARPIECE' ? 'Earpiece' : route === 'BLUETOOTH' ? 'Bluetooth' : 'Wired headset'}${state.route === route ? ' ✓' : ''}`,
        onPress: () => { void engine?.route(route); },
      })).concat([{ text: 'Cancel', onPress: () => {} }]));
    });
  };
  if (state.sleeping) return <GoodnightScreen />;
  return <Screen bottomInset style={{ padding: 0 }}>
    {(!video || !active) && !state.remoteSharing && <CallBackdrop />}
    {video && active && state.remote && <RTCView streamURL={state.remote.toURL()} objectFit="cover" zOrder={0} style={StyleSheet.absoluteFill} />}
    {state.remoteSharing && state.remoteScreen && !showCamera && <ScreenShareView stream={state.remoteScreen} />}
    <CallChrome hide={!state.remoteSharing && video && state.phase === 'connected' && !!state.remote && !state.error}>
      <View style={styles.callHeader}><View style={styles.headerCard}><Header title={video && active ? partner?.display_name ?? 'Your partner' : video ? 'Video call' : 'Voice call'} subtitle={status} /></View></View>
      {(!video || !active || !state.remote) && (!state.remoteSharing || showCamera) && <FadeInView key={state.phase === 'incoming' ? 'incoming' : 'call'} style={styles.identity}><PulseRing size={geometry.avatar * (state.phase === 'incoming' ? 5 : 4)}><PulseRing size={geometry.avatar * (state.phase === 'incoming' ? 4 : 3)}><PartnerAvatar /></PulseRing></PulseRing><Text style={styles.name}>{partner?.display_name ?? 'Your partner'}</Text>
        {state.phase === 'outgoing' && <CallDots />}
        <Text style={styles.subtitle}>{state.phase === 'incoming' ? `${video ? 'Video' : 'Voice'} call · just for you two` : active ? 'A little closer, wherever you are' : 'A moment together'}</Text>
        {state.phase === 'preparing' && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />}
      </FadeInView>}
      {state.phase === 'reconnecting' && <FadeInView accessibilityLiveRegion="polite" style={styles.reconnecting}><ActivityIndicator color={colors.primary} /><Text style={styles.subtitle}>Reconnecting…</Text><Skeleton height={geometry.track} /></FadeInView>}
      <View style={styles.bottom}>
        {state.error && <Text accessibilityLiveRegion="polite" style={styles.error}>{state.error}</Text>}
        {state.phase === 'incoming' ? <View style={styles.controls}>
          <Control icon="close" label="Decline" danger action={() => { void engine?.end(); }} />
          <HeartbeatView><Control icon={video ? 'videocam' : 'call'} label="Accept" selected action={() => { void engine?.accept(); }} /></HeartbeatView>
        </View> : active ? <>
          <Text style={styles.routeLabel}>{state.route === 'BLUETOOTH' ? 'Bluetooth' : state.route === 'WIRED_HEADSET' ? 'Headset' : state.route === 'SPEAKER_PHONE' ? 'Speaker' : 'Earpiece'}</Text>
          {state.sharing && <Text accessibilityLiveRegion="polite" style={styles.subtitle}>You’re sharing your screen</Text>}
          {state.remoteSharing && <Control icon="swap-horizontal" label={showCamera ? 'View shared screen' : 'View camera'} action={() => setShowCamera(value => !value)} />}
          <View style={styles.controls}>
            <Control icon="desktop-outline" label={state.sharing ? 'Stop sharing' : 'Share screen'} selected={state.sharing} action={() => { void (state.sharing ? engine?.stopSharing() : engine?.shareScreen()); }} />
            {!video && <Control icon="moon-outline" label="Goodnight" action={() => { void engine?.goodnight(); }} />}
            <Control icon={state.muted ? 'mic-off' : 'mic'} label={state.muted ? 'Unmute' : 'Mute'} selected={state.muted} action={() => engine?.mute()} />
            {video && <Control icon={state.camera ? 'videocam' : 'videocam-off'} label={state.camera ? 'Camera off' : 'Camera on'} selected={!state.camera} action={() => engine?.camera()} />}
            {video && <Control icon="camera-reverse" label="Flip" action={() => engine?.flip()} />}
            <Control icon="volume-high" label="Audio output" action={chooseRoute} />
            <Control icon="call" label="End call" danger action={() => { void engine?.end(); }} />
          </View>
        </> : <View style={styles.controls}><Control icon="close" label="Cancel" danger action={() => { void engine?.end(); }} /></View>}
        {__DEV__ && state.path && <Text style={styles.debug}>Debug · selected ICE pair: {state.path}</Text>}
      </View>
    </CallChrome>
    {video && active && <LocalPreview />}
  </Screen>;
}

export default function CallsScreen() {
  const styles = useCallStyles(); const { colors, geometry } = useTheme();
  const { data: session } = useSession();
  const ready = useCalls((s) => s.ready);
  const error = useCalls((s) => s.error);
  const params = useLocalSearchParams<{ health?: string }>();
  const [health, setHealth] = useState(params.health === '1');
  const [notice, setNotice] = useState<string | null>(null);
  if (health) return <RingingHealthScreen onBack={() => setHealth(false)} />;
  return <Screen bottomInset><Stack.Screen options={{ title: 'Calls', headerShown: false }} /><Header title="Calls" subtitle="A little closer" />
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.eyebrow}>A LITTLE CLOSER</Text><Text style={styles.pageTitle}>Make time for{`\n`}each other.</Text>
      <Text style={styles.subtitle}>A familiar voice. A face you love.</Text>
      {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      <View style={styles.startButtons}>
        <PressableScale accessibilityRole="button" disabled={!ready} style={[styles.startButton, !ready && styles.disabled]} onPress={() => { void startCall('audio'); }}><Ionicons name="call-outline" size={geometry.icon} color={colors.primaryContrast} /><Text style={styles.startLabel}>Voice call</Text></PressableScale>
        <PressableScale accessibilityRole="button" disabled={!ready} style={[styles.startButton, !ready && styles.disabled]} onPress={() => { void startCall('video'); }}><Ionicons name="videocam-outline" size={geometry.icon} color={colors.primaryContrast} /><Text style={styles.startLabel}>Video call</Text></PressableScale>
      </View>
      {!ready && <Text style={styles.subtitle}>Connecting to your couple’s calling service…</Text>}
      <PressableScale accessibilityRole="button" onPress={() => {
        if (!session) return;
        setNotice('Setting up call notifications…');
        void registerCallNotifications(session.user.id, true).then(() => setNotice('Notification setup checked. Allow notifications in Settings to receive calls when the app is closed.')).catch(() => setNotice('Notifications could not register. Try again on your Android development build.'));
      }}><Text style={styles.link}>Enable call notifications</Text></PressableScale>
      {notice && <Text style={styles.subtitle}>{notice}</Text>}
      <Control icon="notifications-outline" label="Ringing health check" action={() => setHealth(true)} />
      <BedtimeReminder />
      <RecentCalls />
    </ScrollView>
  </Screen>;
}

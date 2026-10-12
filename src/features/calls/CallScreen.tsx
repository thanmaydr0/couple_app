import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Animated, Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RTCView } from 'react-native-webrtc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useAvatar, usePartner, useSession } from '@/lib/hooks';
import { theme } from '@/ui/theme';
import { getCallEngine, startCall, useCalls } from './engine';
import { RecentCalls } from './RecentCalls';
import { registerCallNotifications, requestBluetoothRouting } from './notifications';

type IconName = ComponentProps<typeof Ionicons>['name'];
function Control({ icon, label, action, danger, selected }: { icon: IconName; label: string; action: () => void; danger?: boolean; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={styles.controlWrap}>
    <View style={[styles.control, selected && styles.selected, danger && styles.danger]}><Ionicons name={icon} size={26} color={danger || selected ? theme.colors.onPrimary : theme.colors.text} /></View>
    <Text style={styles.controlLabel}>{label}</Text>
  </Pressable>;
}
function PartnerAvatar() {
  const { data: partner } = usePartner();
  const { data: avatar } = useAvatar(partner?.avatar_path);
  return <View style={styles.avatar}>{avatar ? <Image source={{ uri: avatar }} style={styles.avatarImage} /> : <Text style={styles.initial}>{(partner?.display_name ?? '♥').slice(0, 1).toUpperCase()}</Text>}</View>;
}
function LocalPreview() {
  const local = useCalls((s) => s.local);
  const camera = useCalls((s) => s.camera);
  const front = useCalls((s) => s.front);
  const { width, height } = useWindowDimensions();
  const dimensions = useRef({ width, height }); dimensions.current = { width, height };
  const position = useRef(new Animated.ValueXY({ x: 16, y: 100 })).current;
  const origin = useRef({ x: 16, y: 100 });
  const moved = useRef({ x: 16, y: 100 });
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { origin.current = { ...moved.current }; },
    onPanResponderMove: (_event, gesture) => {
      const x = Math.max(8, Math.min(dimensions.current.width - 128, origin.current.x + gesture.dx));
      const y = Math.max(60, Math.min(dimensions.current.height - 290, origin.current.y + gesture.dy));
      moved.current = { x, y }; position.setValue({ x, y });
    }, onPanResponderTerminationRequest: () => false,
  })).current;
  useEffect(() => {
    moved.current = { x: Math.max(8, Math.min(width - 128, moved.current.x)), y: Math.max(60, Math.min(height - 290, moved.current.y)) };
    position.setValue(moved.current);
  }, [width, height, position]);
  return <Animated.View accessibilityLabel="Your camera preview. Drag to move." {...responder.panHandlers}
    style={[styles.preview, { transform: position.getTranslateTransform() }]}>
    {local && camera ? <RTCView streamURL={local.toURL()} objectFit="cover" mirror={front} zOrder={2} style={StyleSheet.absoluteFill} />
      : <Ionicons name="videocam-off-outline" size={28} color={theme.colors.muted} />}
    <Text style={styles.previewLabel}>You</Text>
  </Animated.View>;
}

export function ActiveCallScreen() {
  const state = useCalls();
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
  return <View style={styles.root}>
    {video && active && state.remote && <RTCView streamURL={state.remote.toURL()} objectFit="cover" zOrder={0} style={StyleSheet.absoluteFill} />}
    <SafeAreaView style={styles.safe}>
      <View style={styles.callHeader}><Text style={styles.eyebrow}>{video ? 'VIDEO CALL' : 'VOICE CALL'}</Text><Text style={styles.status}>{status}</Text></View>
      {(!video || !active || !state.remote) && <View style={styles.identity}><PartnerAvatar /><Text style={styles.name}>{partner?.display_name ?? 'Your partner'}</Text>
        <Text style={styles.subtitle}>{state.phase === 'incoming' ? `${video ? 'Video' : 'Voice'} call · just for you two` : active ? 'A little closer, wherever you are' : 'A moment together'}</Text>
        {state.phase === 'preparing' && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />}
      </View>}
      {state.phase === 'reconnecting' && <View accessibilityLiveRegion="polite" style={styles.reconnecting}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.subtitle}>Reconnecting…</Text></View>}
      <View style={styles.bottom}>
        {state.error && <Text accessibilityLiveRegion="polite" style={styles.error}>{state.error}</Text>}
        {state.phase === 'incoming' ? <View style={styles.controls}>
          <Control icon="close" label="Decline" danger action={() => { void engine?.end(); }} />
          <Control icon={video ? 'videocam' : 'call'} label="Accept" selected action={() => { void engine?.accept(); }} />
        </View> : active ? <>
          <Text style={styles.routeLabel}>{state.route === 'BLUETOOTH' ? 'Bluetooth' : state.route === 'WIRED_HEADSET' ? 'Headset' : state.route === 'SPEAKER_PHONE' ? 'Speaker' : 'Earpiece'}</Text>
          <View style={styles.controls}>
            <Control icon={state.muted ? 'mic-off' : 'mic'} label={state.muted ? 'Unmute' : 'Mute'} selected={state.muted} action={() => engine?.mute()} />
            {video && <Control icon={state.camera ? 'videocam' : 'videocam-off'} label={state.camera ? 'Camera off' : 'Camera on'} selected={!state.camera} action={() => engine?.camera()} />}
            {video && <Control icon="camera-reverse" label="Flip" action={() => engine?.flip()} />}
            <Control icon="volume-high" label="Audio output" action={chooseRoute} />
          </View>
          <View style={styles.controls}><Control icon="call" label="End call" danger action={() => { void engine?.end(); }} /></View>
        </> : <View style={styles.controls}><Control icon="close" label="Cancel" danger action={() => { void engine?.end(); }} /></View>}
        {__DEV__ && state.path && <Text style={styles.debug}>Debug · selected ICE pair: {state.path}</Text>}
      </View>
    </SafeAreaView>
    {video && active && <LocalPreview />}
  </View>;
}

export default function CallsScreen() {
  const { data: session } = useSession();
  const ready = useCalls((s) => s.ready);
  const error = useCalls((s) => s.error);
  const [notice, setNotice] = useState<string | null>(null);
  return <SafeAreaView edges={['bottom']} style={styles.root}><Stack.Screen options={{ title: 'Calls' }} />
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.eyebrow}>A LITTLE CLOSER</Text><Text style={styles.pageTitle}>Make time for{`\n`}each other.</Text>
      <Text style={styles.subtitle}>A familiar voice. A face you love.</Text>
      {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      <View style={styles.startButtons}>
        <Pressable accessibilityRole="button" disabled={!ready} style={[styles.startButton, !ready && styles.disabled]} onPress={() => { void startCall('audio'); }}><Ionicons name="call-outline" size={24} color={theme.colors.onPrimary} /><Text style={styles.startLabel}>Voice call</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!ready} style={[styles.startButton, !ready && styles.disabled]} onPress={() => { void startCall('video'); }}><Ionicons name="videocam-outline" size={24} color={theme.colors.onPrimary} /><Text style={styles.startLabel}>Video call</Text></Pressable>
      </View>
      {!ready && <Text style={styles.subtitle}>Connecting to your couple’s calling service…</Text>}
      <Pressable accessibilityRole="button" onPress={() => {
        if (!session) return;
        setNotice('Setting up call notifications…');
        void registerCallNotifications(session.user.id, true).then(() => setNotice('Notification setup checked. Allow notifications in Settings to receive calls when the app is closed.')).catch(() => setNotice('Notifications could not register. Try again on your Android development build.'));
      }}><Text style={styles.link}>Enable call notifications</Text></Pressable>
      {notice && <Text style={styles.subtitle}>{notice}</Text>}
      <RecentCalls />
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background }, safe: { flex: 1, justifyContent: 'space-between' },
  callHeader: { alignItems: 'center', gap: 8, padding: 20, backgroundColor: '#16111899' },
  eyebrow: { color: theme.colors.primary, fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  status: { color: theme.colors.text, fontSize: 24, fontVariant: ['tabular-nums'] },
  identity: { alignItems: 'center', gap: 16, padding: 24, flex: 1, justifyContent: 'center' },
  avatar: { height: 124, width: 124, borderRadius: 62, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceRaised, overflow: 'hidden' },
  avatarImage: { height: '100%', width: '100%' }, initial: { color: theme.colors.primary, fontSize: 54 },
  name: { fontSize: 30, color: theme.colors.text, fontWeight: '600', textAlign: 'center' },
  subtitle: { color: theme.colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  reconnecting: { position: 'absolute', top: '42%', alignSelf: 'center', padding: 24, borderRadius: 20, backgroundColor: '#161118DD', gap: 12 },
  bottom: { padding: 20, gap: 12, backgroundColor: '#161118BB' }, controls: { flexDirection: 'row', justifyContent: 'space-evenly', gap: 6 },
  controlWrap: { alignItems: 'center', gap: 8, minWidth: 62 }, control: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceRaised },
  selected: { backgroundColor: theme.colors.primary }, danger: { backgroundColor: theme.colors.danger }, controlLabel: { color: theme.colors.text, fontSize: 11 },
  routeLabel: { color: theme.colors.muted, fontSize: 12, textAlign: 'center' }, debug: { color: theme.colors.muted, fontSize: 10, textAlign: 'center' },
  preview: { position: 'absolute', left: 0, top: 0, width: 120, height: 168, backgroundColor: theme.colors.surfaceRaised, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  previewLabel: { position: 'absolute', bottom: 6, left: 8, fontSize: 11, color: '#fff', backgroundColor: '#16111899', padding: 3 },
  error: { color: theme.colors.danger, textAlign: 'center', lineHeight: 21 },
  page: { padding: 24, gap: 20 }, pageTitle: { fontSize: 40, fontWeight: '600', color: theme.colors.text },
  startButtons: { flexDirection: 'row', gap: 12 }, startButton: { flex: 1, backgroundColor: theme.colors.primary, padding: 18, borderRadius: 20, gap: 10, alignItems: 'center' },
  startLabel: { color: theme.colors.onPrimary, fontWeight: '600' }, disabled: { opacity: 0.45 }, link: { color: theme.colors.primary, textAlign: 'center', padding: 12 },
});

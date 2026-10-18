import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Animated, AppState, BackHandler, Image, Modal, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Header, Screen, Text } from '@/ui';
import { useTheme } from '@/theme';
import { FadeInView, PulseRing, useMotion } from '@/motion';
import { authenticate, authenticationInProgress } from './authenticate';
import { setCaptureProtection } from './capture';
import { useLockStore } from './store';
import { requiresUnlock } from './types';
import { AppLockVisibility } from './visibility';

export function AppLockGate({ children }: PropsWithChildren) {
  const { ready, delay, error, hydrate } = useLockStore();
  const { colors, spacing, geometry } = useTheme();
  const motion = useMotion(); const unlockOpacity = useRef(new Animated.Value(1)).current;
  const [locked, setLocked] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const [captureReady, setCaptureReady] = useState(false); const [captureError, setCaptureError] = useState(false);
  const [captureAttempt, setCaptureAttempt] = useState(0);
  const mountedContent = useRef(false); const backgroundAt = useRef<number | null>(null);
  const alive = useRef(true);
  const lockEnabled = ready && delay !== 'off';
  useEffect(() => { alive.current = true; void hydrate(); return () => { alive.current = false; unlockOpacity.stopAnimation(); }; }, [hydrate, unlockOpacity]);
  useEffect(() => {
    let current = true; setCaptureReady(false); setCaptureError(false);
    // Keep Android FLAG_SECURE active to prevent recents snapshot races.
    void setCaptureProtection('us.applock', lockEnabled).then(() => { if (current) setCaptureReady(true); })
      .catch(() => { if (current) setCaptureError(true); });
    return () => { current = false; };
  }, [lockEnabled, captureAttempt]);
  useEffect(() => () => { void setCaptureProtection('us.applock', false).catch(() => {}); }, []);
  useEffect(() => {
    const cover = (trackDelay: boolean) => {
      setForeground(false);
      unlockOpacity.stopAnimation(); unlockOpacity.setValue(1);
      if (trackDelay && backgroundAt.current === null) backgroundAt.current = Date.now();
    };
    const reveal = () => {
      if (AppState.currentState !== 'active') return;
      // Evaluate expiry before clearing the cover, so a stale unlocked frame is never committed.
      if (backgroundAt.current !== null && requiresUnlock(delay, backgroundAt.current, Date.now())) setLocked(true);
      backgroundAt.current = null; setForeground(true);
    };
    const change = AppState.addEventListener('change', state => { if (state === 'active') reveal(); else cover(true); });
    // A credential dialog loses focus without leaving the app. Actual background events
    // still start the timer, even if an authentication attempt is outstanding.
    const blur = AppState.addEventListener('blur', () => cover(!authenticationInProgress()));
    const focus = AppState.addEventListener('focus', reveal);
    return () => { change.remove(); blur.remove(); focus.remove(); };
  }, [delay, unlockOpacity]);
  const covered = !ready || (lockEnabled && (locked || !foreground || !captureReady));
  useEffect(() => {
    if (!covered) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => back.remove();
  }, [covered]);
  const unlock = async () => {
    if (busy) return; setBusy(true); setNotice('');
    try {
      await authenticate();
      if (!alive.current) return;
      if (AppState.currentState !== 'active') return;
      backgroundAt.current = null; setForeground(true);
      await new Promise<void>(resolve => Animated.timing(unlockOpacity, { toValue: 0, duration: motion.duration('base'), useNativeDriver: true }).start(({ finished }) => {
        if (finished && alive.current && AppState.currentState === 'active' && backgroundAt.current === null) setLocked(false);
        unlockOpacity.setValue(1); resolve();
      }));
    } catch (cause) { if (alive.current) setNotice(cause instanceof Error ? cause.message : 'Could not unlock. Try again.'); }
    finally { if (alive.current) setBusy(false); }
  };
  if (!covered) mountedContent.current = true;
  const lockScreen = <Screen centered bottomInset style={{ backgroundColor: colors.bg }}>
    <Animated.View accessibilityViewIsModal style={{ opacity: unlockOpacity, width: '100%', alignItems: 'center', gap: spacing.lg }}>
      <Image source={require('../../../assets/splash-mark.png')} accessibilityLabel="Us app logo" style={{ width: geometry.touch * 2, height: geometry.touch * 2 }} resizeMode="contain" />
      <Header title={ready ? 'Your space is locked' : 'Protecting your space'} />
      <PulseRing><Ionicons name="lock-closed-outline" size={geometry.icon} color={colors.primary} /></PulseRing>
      <Text color="textSecondary" style={{ textAlign: 'center' }}>Only your device biometrics, PIN, pattern or password can open this space.</Text>
      {!!(error || notice) && <Text accessibilityRole="alert" color="danger">{error || notice}</Text>}
      {!ready ? error ? <Button title="Try loading again" onPress={() => { void hydrate(); }} /> : <Text accessibilityRole="progressbar">Loading lock settings…</Text>
        : captureError ? <><Text color="danger">Screen protection could not start. Your space stays covered.</Text><Button title="Retry protection" onPress={() => setCaptureAttempt(value => value + 1)} /></>
        : <Button title={busy ? 'Unlocking…' : 'Unlock'} loading={busy} disabled={AppState.currentState !== 'active' || !captureReady} onPress={() => { void unlock(); }} />}
    </Animated.View>
  </Screen>;
  // Children are first mounted only after local policy and cold-start authentication resolve.
  return <AppLockVisibility.Provider value={covered}><View style={{ flex: 1, backgroundColor: colors.bg }}>
    {mountedContent.current && <View pointerEvents={covered ? 'none' : 'auto'} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'} style={{ flex: 1, display: covered ? 'none' : 'flex' }}>
      <FadeInView style={{ flex: 1 }}>{children}</FadeInView>
    </View>}
    {covered && lockScreen}
    <Modal visible={covered} animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}}>{lockScreen}</Modal>
  </View></AppLockVisibility.Provider>;
}

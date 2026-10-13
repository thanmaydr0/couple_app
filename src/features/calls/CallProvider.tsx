import { bindCallActions, consumeAccept, rememberAccept, notify, showIncoming } from '../ringing/runtime';
import { AppState } from 'react-native';
import { useEffect, type PropsWithChildren } from 'react';
import { Alert, Modal } from 'react-native';
import * as Notifications from 'expo-notifications';
import { usePartner, useProfile, useSession } from '@/lib/hooks';
import { CallEngine, attachEngine, detachEngine, useCalls } from './engine';
import { ActiveCallScreen } from './CallScreen';
import { useMotion } from '@/motion';

export function CallProvider({ children }: PropsWithChildren) {
  const motion = useMotion();
  const { data: session } = useSession();
  const { data: profile } = useProfile();
  const { data: partner } = usePartner();
  const uid = session?.user.id;
  const coupleId = profile?.id === uid ? profile?.couple_id : null;
  const partnerId = partner?.couple_id === coupleId ? partner?.id : null;
  const phase = useCalls((s) => s.phase);
  const error = useCalls((s) => s.error);
  useEffect(() => {
    if (error && phase === 'idle') Alert.alert('Call', error);
  }, [error, phase]);
  useEffect(() => {
    if (!uid || !coupleId || !partnerId) return;
    const engine = new CallEngine(uid, coupleId, partnerId);
    bindCallActions({ ready: () => useCalls.getState().ready, end: () => engine.end(), stopSharing: () => engine.stopSharing(), accept: async id => { if (await engine.openIncomingNotification(id)) await engine.accept(); } });
    attachEngine(engine); engine.mount();
    const resume = AppState.addEventListener('change', state => { if (state === 'active') void consumeAccept(); });
    const pending = setInterval(() => { if (useCalls.getState().ready) void consumeAccept(); }, 1000);
    void notify.getInitialNotification().then(async initial => {
      const id = initial?.notification.data?.callId;
      if (typeof id === 'string') {
        if (initial?.pressAction.id === 'accept') await rememberAccept(id);
        await engine.openIncomingNotification(id);
      }
    }).catch(() => console.warn('[ringing] Initial notification unavailable.'));
    const recover = () => { void engine.recover(); };
    // Tap routing belongs to PushProvider; foreground calls recover globally.
    const received = Notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.content.data?.type === 'call') { recover(); void showIncoming(notification.request.content.data); }
    });
    return () => { clearInterval(pending); resume.remove(); bindCallActions(undefined); received.remove(); detachEngine(engine); engine.dispose(); };
  }, [uid, coupleId, partnerId]);
  return <>{children}<Modal visible={phase !== 'idle'} animationType={motion.level === 'off' ? 'none' : 'fade'} presentationStyle="fullScreen" statusBarTranslucent
    onRequestClose={() => { /* A back press must not accidentally end or hide an incoming call. */ }}>
    <ActiveCallScreen />
  </Modal></>;
}

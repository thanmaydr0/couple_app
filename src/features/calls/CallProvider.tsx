import { useEffect, type PropsWithChildren } from 'react';
import { Alert, Modal } from 'react-native';
import * as Notifications from 'expo-notifications';
import { usePartner, useProfile, useSession } from '@/lib/hooks';
import { CallEngine, attachEngine, detachEngine, useCalls } from './engine';
import { ActiveCallScreen } from './CallScreen';

export function CallProvider({ children }: PropsWithChildren) {
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
    attachEngine(engine); engine.mount();
    const recover = () => { void engine.recover(); };
    // Tap routing belongs to PushProvider; foreground calls recover globally.
    const received = Notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.content.data?.type === 'call') recover();
    });
    return () => { received.remove(); detachEngine(engine); engine.dispose(); };
  }, [uid, coupleId, partnerId]);
  return <>{children}<Modal visible={phase !== 'idle'} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent
    onRequestClose={() => { /* A back press must not accidentally end or hide an incoming call. */ }}>
    <ActiveCallScreen />
  </Modal></>;
}

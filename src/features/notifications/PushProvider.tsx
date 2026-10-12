import { useEffect, useRef, type PropsWithChildren } from 'react';
import { AppState, ToastAndroid } from 'react-native';
import { usePathname, useRootNavigationState, useRouter, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useProfile, useSession } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { getCallEngine, useCalls } from '@/features/calls/engine';
import { createChannels, registerPush } from './service';
import { featureRegistry } from '@/features/registry';
import { notificationType, showForeground } from './policy';

// Set synchronously on module load, before any foreground push arrives.
const foreground = { uid: '', coupleId: '', chatOpen: false };
Notifications.setNotificationHandler({ handleNotification: async (notification) => {
  const data = notification.request.content.data ?? {};
  let read = false;
  const snapshot = { ...foreground };
  if (notificationType(data) === 'message' && !snapshot.chatOpen && snapshot.uid && snapshot.coupleId && typeof data.message_id === 'string') {
    // Keep inside Expo's 3-second handler deadline even when offline.
    try {
      const result = await supabase.from('messages').select('read_at').eq('id', data.message_id)
        .eq('couple_id', snapshot.coupleId).neq('sender_id', snapshot.uid).abortSignal(AbortSignal.timeout(1200)).maybeSingle();
      read = !!result.data?.read_at;
    } catch { /* Show the notification if the receipt cannot be checked. */ }
  }
  const show = showForeground(data, foreground.chatOpen, read);
  return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false,
    priority: notificationType(data) === 'call' ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.DEFAULT };
} });

export function PushProvider({ children }: PropsWithChildren) {
  const { data: session } = useSession();
  const { data: profile, isSuccess: profileReady } = useProfile();
  const uid = session?.user.id;
  const coupleId = profile && profile.id === uid ? profile.couple_id : null;
  const pathname = usePathname();
  const router = useRouter();
  const navigation = useRootNavigationState();
  const callReady = useCalls((state) => state.ready);
  const pending = useRef<Notifications.NotificationResponse | null>(null);
  const handled = useRef(new Set<string>());
  const drain = useRef<() => void>(() => {});
  const running = useRef(false);
  foreground.uid = uid ?? '';
  foreground.coupleId = coupleId ?? '';
  foreground.chatOpen = pathname === '/chat' && AppState.currentState === 'active';

  useEffect(() => { void createChannels().catch(() => console.warn('[push] Channels could not be created.')); }, []);

  useEffect(() => {
    if (!uid) return;
    const refresh = () => { void registerPush(uid).catch(() => console.warn('[push] Registration failed; retry in Settings.')); };
    refresh();
    const state = AppState.addEventListener('change', (next) => {
      foreground.chatOpen = pathname === '/chat' && next === 'active';
      if (next === 'active') refresh();
    });
    const token = Notifications.addPushTokenListener(refresh);
    return () => { state.remove(); token.remove(); };
  }, [uid, pathname]);

  drain.current = () => {
    const response = pending.current;
    if (!response || !uid || !navigation?.key || !profileReady || running.current) return;
    const data = response.notification.request.content.data ?? {};
    const type = notificationType(data);
    if (type === 'call' && coupleId && (!callReady || !getCallEngine())) return;
    pending.current = null;
    const id = response.notification.request.identifier;
    if (handled.current.has(id)) return;
    handled.current.add(id);
    running.current = true;
    void (async () => {
      // Ignore old-account/couple notifications; payload URLs are never followed.
      if (typeof data.recipientId === 'string' && data.recipientId !== uid) return;
      const pushCouple = data.coupleId ?? data.couple_id;
      if (typeof pushCouple === 'string' && pushCouple !== coupleId) return;
      if (type === 'message' && typeof data.route !== 'string') router.push('/(tabs)/chat');
      if (type === 'call') {
        const callId = data.callId;
        const opened = typeof callId === 'string' && await getCallEngine()?.openIncomingNotification(callId);
        if (!opened) {
          router.replace('/(tabs)');
          ToastAndroid.show('Missed call', ToastAndroid.LONG);
        }
      }
      if (type !== 'call' && typeof data.route === 'string') {
        const staticRoutes = ['/us', '/(tabs)', '/(tabs)/chat', '/(tabs)/memories', '/(tabs)/watch', '/(tabs)/games', '/settings', '/settings/features', '/settings/appearance', '/games/chess', '/games/scribble'];
        if (staticRoutes.includes(data.route) || featureRegistry.some(feature => feature.enabled && feature.route === data.route)) router.push(data.route as Href);
      }
    })().then(() => Notifications.clearLastNotificationResponseAsync()).catch(() => {
      handled.current.delete(id);
      ToastAndroid.show('Could not open notification. Check your connection and tap it again.', ToastAndroid.LONG);
    }).finally(() => { running.current = false; drain.current(); });
  };

  useEffect(() => {
    const enqueue = (response: Notifications.NotificationResponse) => { pending.current = response; drain.current(); };
    const listener = Notifications.addNotificationResponseReceivedListener(enqueue);
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) enqueue(response); }).catch(() => {});
    return () => listener.remove();
  }, []);
  useEffect(() => { drain.current(); }, [uid, coupleId, profileReady, callReady, navigation?.key]);
  return children;
}

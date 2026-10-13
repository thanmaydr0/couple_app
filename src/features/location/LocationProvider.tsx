import { useEffect, useRef, type PropsWithChildren } from 'react';
import { AppState, View } from 'react-native';
import { router } from 'expo-router';
import notifee, { EventType } from 'react-native-notify-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile, useSession } from '@/lib/hooks';
import { useTheme } from '@/theme';
import { PressableScale } from '@/motion';
import { Button, Text } from '@/ui';
import { restoreSharing, retryDeletion, stopSharing } from './runtime';
import { useLocationState } from './store';

export function LocationProvider({ children }: PropsWithChildren) {
  const { data: session } = useSession();
  const { data: profile } = useProfile();
  const uid = session?.user.id;
  const coupleId = profile?.id === uid ? profile?.couple_id : null;
  const previous = useRef<string | null>(null);
  const { lease, error, pendingStop } = useLocationState();
  const { colors, spacing, geometry } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    let disposed = false;
    const restore = async () => {
      if (previous.current && previous.current !== `${uid}:${coupleId}`) await stopSharing().catch(() => {});
      if (disposed || !uid || !coupleId) return;
      previous.current = `${uid}:${coupleId}`;
      await restoreSharing(uid, coupleId);
    };
    void restore().catch(() => useLocationState.setState({ ready: true, error: 'Location recovery failed. Open Location and retry Stop before sharing again.' }));
    const app = AppState.addEventListener('change', state => { if (state === 'active') void restore().catch(() => {}); });
    const retry = setInterval(() => { if (useLocationState.getState().pendingStop) void retryDeletion().catch(() => {}); }, 30_000);
    return () => { disposed = true; app.remove(); clearInterval(retry); };
  }, [uid, coupleId]);
  useEffect(() => notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'location-stop') void stopSharing().catch(() => {});
    if (type === EventType.PRESS && detail.notification?.id === 'us-location-sharing') router.push('/us/location');
  }), []);
  return <View style={{ flex: 1 }}>
    {children}
    {(lease || pendingStop) && <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.surface, borderTopWidth: geometry.stroke, borderColor: colors.primary, padding: spacing.sm, paddingBottom: Math.max(spacing.sm, insets.bottom), gap: spacing.sm }}>
      <PressableScale accessibilityRole="button" onPress={() => router.push('/us/location')} style={{ justifyContent: 'center', minHeight: geometry.touch }}>
        <Text variant="label" color={lease ? 'primary' : 'danger'}>{lease ? "You're sharing your location" : 'Server location deletion pending'}</Text>
        <Text variant="caption">{lease ? lease.until === 'infinity' ? 'Until you stop · tap to open controls' : `Ends ${new Date(lease.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · tap for controls` : error ?? 'Reconnect to finish Stop.'}</Text>
      </PressableScale>
      <Button title={lease ? 'Stop sharing now' : 'Retry server deletion'} variant="danger" onPress={() => { void (lease ? stopSharing() : retryDeletion()).catch(() => {}); }} />
    </View>}
  </View>;
}

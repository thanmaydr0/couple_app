import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Header, OfflineBanner, Screen, Skeleton, useToast } from '@/ui';
import { useTheme } from '@/theme';
import { AnimatedNumber, HeartbeatView, useMotion } from '@/motion';

/** Connectivity is presentation only; existing queries and presence remain untouched. */
export function OfflineNotice({ message = 'You’re offline. Live status and changes may be out of date.' }: { message?: string }) {
  const network = useNetInfo();
  return <OfflineBanner offline={network.isConnected === false || network.isInternetReachable === false} message={message} />;
}

export function DaysCounter({ value }: { value: number }) {
  const { colors, typography } = useTheme();
  const motion = useMotion();
  const [displayValue, setDisplayValue] = useState(motion.level === 'full' ? 0 : value);
  useEffect(() => { setDisplayValue(value); }, [value]);
  return <HeartbeatView><AnimatedNumber value={motion.level === 'full' ? displayValue : value} accessibilityLabel={`${value.toLocaleString()} days together`} style={{ ...typography['display/L'], color: colors.primary }} /></HeartbeatView>;
}

export function FailureToast({ message }: { message: string }) {
  const { show } = useToast();
  useEffect(() => { if (message) show({ message, kind: 'error' }); }, [message]);
  return null;
}

export function PageSkeleton({ title }: { title: string }) {
  const { spacing, geometry } = useTheme();
  return <Screen><Header title={title} /><OfflineNotice /><View style={{ gap: spacing.md, paddingTop: spacing.md }}>
    <Skeleton height={geometry.touch * 3} />
    <Skeleton height={geometry.touch * 2} />
    <Skeleton height={geometry.touch * 2} />
  </View></Screen>;
}

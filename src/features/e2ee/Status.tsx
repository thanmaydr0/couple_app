import { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Text, Button } from '@/ui';
import { useTheme } from '@/theme';
import { snapshot, subscribe } from './runtime';
export const useEncryption = () => useSyncExternalStore(subscribe, snapshot, snapshot);
export function EncryptionStatus() {
  const state = useEncryption(); const { spacing } = useTheme();
  return <View style={{ gap: spacing.xs, paddingHorizontal: spacing.lg }}>
    <Text variant="caption" color={state.changed || state.error ? 'danger' : 'textSecondary'}>{state.changed ? 'Safety number changed. Sending is blocked until you acknowledge it.' : state.enabled ? state.verified ? '🔒 Encrypted · Verified on this phone' : '🔒 Encrypted · Compare safety numbers' : 'Encryption is off · legacy messages are plaintext'}</Text>
    {(state.changed || state.enabled && !state.local || !!state.error) && <Button title="Review encryption" onPress={() => router.push('/us/e2ee')} />}
  </View>;
}

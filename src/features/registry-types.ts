import type { ComponentType, ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
export type FeatureExtension = { enabled: boolean; HomeCard?: ComponentType; SettingsSection?: ComponentType };
export type FeatureEntry = FeatureExtension & {
  id: string; title: string; subtitle: string; icon: ComponentProps<typeof Ionicons>['name'];
  route: `/us/${string}`; group: 'us' | 'game' | 'tool'; needsNative: boolean; migration: string | null;
};

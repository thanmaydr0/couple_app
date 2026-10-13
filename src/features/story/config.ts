import type { FeatureExtension } from '../registry-types';
import { HomeCard, SettingsSection } from './HomeCard';
import { installStoryStartup } from './notifications';
installStoryStartup();
export const feature: FeatureExtension = { enabled: true, HomeCard, SettingsSection };

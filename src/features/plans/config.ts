import type { FeatureExtension } from '../registry-types';
// Own this file: enable after implementation and optionally attach HomeCard / SettingsSection.
import { HomeCard } from './CountdownCard';
import { startPlansReminderService } from './reminderService';
startPlansReminderService();
export const feature: FeatureExtension = { enabled: true, HomeCard };

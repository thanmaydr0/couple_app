import type { Href } from 'expo-router';
import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { FeatureEntry } from '../registry-types';

export type MenuItem = { id: string; title: string; subtitle: string; route: Href; icon: ComponentProps<typeof Ionicons>['name']; section: string };
export const sections = ['Connect', 'Play & watch', 'Memories & milestones', 'Everyday together', 'Privacy & settings'] as const;
const membership: Record<string, string> = {
  pulse: 'Connect', touch: 'Connect', voice: 'Connect', chatplus: 'Connect', ringing: 'Connect',
  gamenight: 'Play & watch', yt: 'Play & watch',
  capsule: 'Memories & milestones', story: 'Memories & milestones', book: 'Memories & milestones',
  plans: 'Everyday together', lists: 'Everyday together', wallet: 'Everyday together', focus: 'Everyday together', places: 'Everyday together', location: 'Everyday together', widgets: 'Everyday together',
  applock: 'Privacy & settings', e2ee: 'Privacy & settings', vault: 'Privacy & settings',
};
const core: MenuItem[] = [
  { id: 'chat', title: 'Chat', subtitle: 'Messages, photos and conversations', route: '/(tabs)/chat', icon: 'chatbubbles-outline', section: 'Connect' },
  { id: 'audio', title: 'Voice call', subtitle: 'Hear your partner', route: { pathname: '/call', params: { kind: 'audio' } }, icon: 'call-outline', section: 'Connect' },
  { id: 'video', title: 'Video call', subtitle: 'Spend time face to face', route: { pathname: '/call', params: { kind: 'video' } }, icon: 'videocam-outline', section: 'Connect' },
  { id: 'movie', title: 'Watch a movie', subtitle: 'Play your own files in sync', route: '/(tabs)/watch', icon: 'film-outline', section: 'Play & watch' },
  { id: 'chess', title: 'Chess', subtitle: 'Your next move together', route: '/games/chess', icon: 'grid-outline', section: 'Play & watch' },
  { id: 'scribble', title: 'Scribble', subtitle: 'Draw, guess and laugh', route: '/games/scribble', icon: 'brush-outline', section: 'Play & watch' },
  { id: 'memories', title: 'Memories', subtitle: 'Your shared photos and videos', route: '/(tabs)/memories', icon: 'images-outline', section: 'Memories & milestones' },
  { id: 'settings', title: 'Profile & settings', subtitle: 'Your profile, anniversary and notifications', route: '/settings', icon: 'settings-outline', section: 'Privacy & settings' },
  { id: 'appearance', title: 'Appearance', subtitle: 'Themes and animation preferences', route: '/settings/appearance', icon: 'color-palette-outline', section: 'Privacy & settings' },
  { id: 'shortcuts', title: 'Home shortcuts', subtitle: 'Choose features shown on your home screen', route: '/settings/features', icon: 'options-outline', section: 'Privacy & settings' },
];
export function buildCatalog(features: readonly FeatureEntry[]): MenuItem[] {
  return [...core, ...features.filter(feature => feature.enabled).map(feature => ({ ...feature, title: feature.id === 'touch' ? 'Touch Together' : feature.title, section: membership[feature.id] ?? 'Everyday together' }))];
}
export function searchCatalog(items: readonly MenuItem[], query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => words.every(word => `${item.title} ${item.subtitle} ${item.section}`.toLocaleLowerCase().includes(word)));
}

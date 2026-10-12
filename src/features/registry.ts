import type { FeatureEntry } from './registry-types';
import { feature as pulse } from './pulse/config';
import { feature as touch } from './touch/config';
import { feature as capsule } from './capsule/config';
import { feature as lists } from './lists/config';
import { feature as plans } from './plans/config';
import { feature as gamenight } from './gamenight/config';
import { feature as wallet } from './wallet/config';
import { feature as focus } from './focus/config';
import { feature as story } from './story/config';
import { feature as chatplus } from './chatplus/config';
import { feature as places } from './places/config';
import { feature as voice } from './voice/config';
import { feature as location } from './location/config';
import { feature as yt } from './yt/config';
import { feature as applock } from './applock/config';
import { feature as e2ee } from './e2ee/config';
import { feature as vault } from './vault/config';
import { feature as ringing } from './ringing/config';
import { feature as widgets } from './widgets/config';
import { feature as book } from './book/config';

export const featureRegistry: readonly FeatureEntry[] = [
  { id: 'pulse', title: 'Pulse', subtitle: 'Little signals of love', icon: 'heart-outline', route: '/us/pulse', group: 'us', needsNative: false, migration: '110_pulse.sql', ...pulse },
  { id: 'touch', title: 'Touch', subtitle: 'Feel a little closer', icon: 'finger-print-outline', route: '/us/touch', group: 'us', needsNative: false, migration: null, ...touch },
  { id: 'capsule', title: 'Time capsules', subtitle: 'Save something for later', icon: 'archive-outline', route: '/us/capsule', group: 'us', needsNative: false, migration: '130_capsule.sql', ...capsule },
  { id: 'lists', title: 'Our lists', subtitle: 'Keep your shared lists close', icon: 'list-outline', route: '/us/lists', group: 'tool', needsNative: false, migration: '140_lists.sql', ...lists },
  { id: 'plans', title: 'Plans', subtitle: 'Make time for each other', icon: 'calendar-outline', route: '/us/plans', group: 'us', needsNative: false, migration: '150_plans.sql', ...plans },
  { id: 'gamenight', title: 'Game night', subtitle: 'A playful evening for two', icon: 'game-controller-outline', route: '/us/gamenight', group: 'game', needsNative: false, migration: '160_gamenight.sql', ...gamenight },
  { id: 'wallet', title: 'Wallet', subtitle: 'Shared expenses made clear', icon: 'wallet-outline', route: '/us/wallet', group: 'tool', needsNative: false, migration: '170_wallet.sql', ...wallet },
  { id: 'focus', title: 'Focus', subtitle: 'A little quiet time together', icon: 'timer-outline', route: '/us/focus', group: 'tool', needsNative: false, migration: '180_focus.sql', ...focus },
  { id: 'story', title: 'Our story', subtitle: 'Keep your chapters together', icon: 'book-outline', route: '/us/story', group: 'us', needsNative: false, migration: '190_story.sql', ...story },
  { id: 'chatplus', title: 'Chat extras', subtitle: 'More ways to say hello', icon: 'chatbubbles-outline', route: '/us/chatplus', group: 'us', needsNative: false, migration: '200_chatplus.sql', ...chatplus },
  { id: 'places', title: 'Places', subtitle: 'Find your next favorite place', icon: 'map-outline', route: '/us/places', group: 'us', needsNative: false, migration: '210_places.sql', ...places },
  { id: 'voice', title: 'Voice', subtitle: 'Keep a familiar voice close', icon: 'mic-outline', route: '/us/voice', group: 'us', needsNative: true, migration: '300_voice.sql', ...voice },
  { id: 'location', title: 'Location', subtitle: 'Share where you are, by choice', icon: 'location-outline', route: '/us/location', group: 'us', needsNative: true, migration: '310_location.sql', ...location },
  { id: 'yt', title: 'Watch videos', subtitle: 'Discover something together', icon: 'play-circle-outline', route: '/us/yt', group: 'us', needsNative: true, migration: '320_yt.sql', ...yt },
  { id: 'applock', title: 'App lock', subtitle: 'Keep your space private', icon: 'lock-closed-outline', route: '/us/applock', group: 'tool', needsNative: true, migration: '330_applock.sql', ...applock },
  { id: 'e2ee', title: 'Encryption', subtitle: 'Protect your conversations', icon: 'key-outline', route: '/us/e2ee', group: 'tool', needsNative: true, migration: '340_e2ee.sql', ...e2ee },
  { id: 'vault', title: 'Vault', subtitle: 'A private place for keepsakes', icon: 'shield-checkmark-outline', route: '/us/vault', group: 'tool', needsNative: true, migration: '350_vault.sql', ...vault },
  { id: 'ringing', title: 'Ringing', subtitle: 'Stay connected when it matters', icon: 'call-outline', route: '/us/ringing', group: 'tool', needsNative: true, migration: '360_ringing.sql', ...ringing },
  { id: 'widgets', title: 'Widgets', subtitle: 'A little us on your home screen', icon: 'grid-outline', route: '/us/widgets', group: 'tool', needsNative: true, migration: '370_widgets.sql', ...widgets },
  { id: 'book', title: 'Our book', subtitle: 'Your shared story, collected', icon: 'journal-outline', route: '/us/book', group: 'us', needsNative: false, migration: null, ...book },
];
export default featureRegistry;

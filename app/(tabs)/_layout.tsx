import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { theme } from '@/ui/theme';

const tabs: { name: string; title: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { name: 'index', title: 'Home', icon: 'heart-outline' },
  { name: 'chat', title: 'Chat', icon: 'chatbubble-outline' },
  { name: 'memories', title: 'Memories', icon: 'images-outline' },
  { name: 'watch', title: 'Watch', icon: 'play-circle-outline' },
  { name: 'games', title: 'Games', icon: 'game-controller-outline' },
];
export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.colors.primary, tabBarInactiveTintColor: theme.colors.muted, tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }, sceneStyle: { backgroundColor: theme.colors.background } }}>
    {tabs.map(({ name, title, icon }) => <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color, size }) => <Ionicons name={icon} color={color} size={size} /> }} />)}
  </Tabs>;
}

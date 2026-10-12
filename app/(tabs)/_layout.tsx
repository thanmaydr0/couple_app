import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { useTheme } from '@/theme';
import { AnimatedBottomTabBar } from '@/motion';
import { useUnreadCount } from '@/features/chat/useUnreadCount';

const tabs: { name: string; title: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { name: 'index', title: 'Home', icon: 'heart-outline' },
  { name: 'chat', title: 'Chat', icon: 'chatbubble-outline' },
  { name: 'memories', title: 'Memories', icon: 'images-outline' },
  { name: 'watch', title: 'Watch', icon: 'play-circle-outline' },
  { name: 'games', title: 'Games', icon: 'game-controller-outline' },
];
export default function TabLayout() {
  const { colors, geometry } = useTheme();
  const unreadCount = useUnreadCount();
  return <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }} tabBar={({ state, navigation }) => <AnimatedBottomTabBar
    activeKey={state.routes[state.index]?.key ?? ''}
    tabs={state.routes.map(route => {
      const item = tabs.find(tab => tab.name === route.name);
      return { key: route.key, label: item?.title ?? route.name, badge: route.name === 'chat' ? unreadCount : undefined,
        icon: (active: boolean) => <Ionicons name={item?.icon ?? 'heart-outline'} size={geometry.icon} color={active ? colors.primaryContrast : colors.textSecondary} /> };
    })}
    onTabPress={key => {
      const route = state.routes.find(item => item.key === key);
      if (!route) return;
      const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
      if (state.routes[state.index]?.key !== key && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    }}
    onTabLongPress={key => { navigation.emit({ type: 'tabLongPress', target: key }); }}
  />}>
    {tabs.map(({ name, title, icon }) => <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color, size }) => <Ionicons name={icon} color={color} size={size} /> }} />)}
  </Tabs>;
}

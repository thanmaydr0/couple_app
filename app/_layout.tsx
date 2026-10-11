import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { QueryProvider } from '@/lib/QueryProvider';
import { AuthGate } from '@/lib/AuthGate';
import { SessionProvider, useSession } from '@/lib/session';
import { PresenceProvider } from '@/features/presence/PresenceProvider';
import { CallProvider } from '@/features/calls/CallProvider';
import { theme } from '@/ui/theme';

function AppShell() {
  const { data: session } = useSession();
  return <PresenceProvider><CallProvider><AuthGate>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: theme.colors.background }, headerTintColor: theme.colors.text, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="call" options={{ title: 'Call', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="watch/[id]" options={{ title: 'Watch together', headerShown: false }} />
        <Stack.Screen name="games/chess" options={{ title: 'Chess' }} />
        <Stack.Screen name="games/scribble" options={{ title: 'Scribble' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </AuthGate></CallProvider></PresenceProvider>;
}
export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <SafeAreaProvider><KeyboardProvider preload={false}><QueryProvider><SessionProvider><AppShell /></SessionProvider></QueryProvider></KeyboardProvider></SafeAreaProvider>
  </GestureHandlerRootView>;
}

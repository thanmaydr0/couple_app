import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { Stack, router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useFonts, loadAsync } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { QueryProvider } from '@/lib/QueryProvider';
import { AuthGate } from '@/lib/AuthGate';
import { SessionProvider, useSession } from '@/lib/session';
import { PresenceProvider } from '@/features/presence/PresenceProvider';
import { CallProvider } from '@/features/calls/CallProvider';
import { PushProvider } from '@/features/notifications/PushProvider';
import { ThemeProvider, useTheme, useThemeStore } from '@/theme';
import { fonts } from '@/theme/fonts';
import { ToastProvider, useStackTransition } from '@/motion';
import { IconButton, ErrorState, Screen } from '@/ui';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function AppShell() {
  const { data: session } = useSession();
  const { colors } = useTheme();
  const transitions = useStackTransition();
  return <PresenceProvider><CallProvider><PushProvider><AuthGate>
      <Stack screenOptions={{ ...transitions, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textPrimary, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="ui-lab" options={{ headerShown: false }} />
        </Stack.Protected>
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
    </AuthGate></PushProvider></CallProvider></PresenceProvider>;
}
export default function RootLayout() {
  const [loaded, fontError] = useFonts(fonts);
  const hydrated = useThemeStore(s => s.hydrated);
  const [retried, setRetried] = useState(false);
  const [retryError, setRetryError] = useState(false);
  useEffect(() => { if (hydrated && (loaded || retried || fontError)) void SplashScreen.hideAsync().catch(() => {}); }, [loaded, retried, fontError, hydrated]);
  if (!hydrated || (!loaded && !retried && !fontError)) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider><ThemeProvider><KeyboardProvider preload={false}><ToastProvider>
      {fontError && !retried ? <Screen centered><ErrorState title="Fonts couldn’t load" description={retryError ? 'Please try loading the fonts again.' : 'Your space is ready. Try loading its fonts again.'} onRetry={() => { void loadAsync(fonts).then(() => setRetried(true)).catch(() => setRetryError(true)); }} /></Screen> : <QueryProvider><SessionProvider><AppShell /><DevLabEntry /></SessionProvider></QueryProvider>}
    </ToastProvider></KeyboardProvider></ThemeProvider></SafeAreaProvider>
  </GestureHandlerRootView>;
}

function DevLabEntry() {
  const path = usePathname(); const { spacing } = useTheme();
  if (!__DEV__ || path === '/ui-lab') return null;
  return <View style={{ position: 'absolute', right: spacing.sm, top: spacing.s56 }}><IconButton name="flask-outline" accessibilityLabel="Open Design Lab" onPress={() => router.push('/ui-lab')} /></View>;
}

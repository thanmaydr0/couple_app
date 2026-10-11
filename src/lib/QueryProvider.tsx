import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from './supabase';

export function QueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 2 } } }));
  useEffect(() => {
    const updateFocus = (state: string) => {
      focusManager.setFocused(state === 'active');
      if (isSupabaseConfigured) {
        if (state === 'active') supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      }
    };
    updateFocus(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateFocus);
    const unsubscribe = NetInfo.addEventListener((state) => {
      onlineManager.setOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    return () => {
      subscription.remove();
      unsubscribe();
      if (isSupabaseConfigured) supabase.auth.stopAutoRefresh();
    };
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { useState, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useProfile, useSession } from './hooks';
import { supabase } from './supabase';
import { Screen, Text, Button, theme } from '@/ui';
import { LoadingScreen } from '@/ui/LoadingScreen';
import { friendlyError } from './errors';

export function AuthGate({ children }: PropsWithChildren) {
  const session = useSession();
  const profile = useProfile();
  const [logoutError, setLogoutError] = useState('');
  const loading = session.isPending || (!!session.data && profile.isPending);
  const error = session.error || (session.data ? profile.error : null);
  const unpaired = !!session.data && profile.isSuccess && !profile.data?.couple_id;
  const blocked = !!(loading || error || unpaired);
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }} pointerEvents={blocked ? 'none' : 'auto'} importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}>{children}</View>
    {blocked && <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, backgroundColor: theme.colors.background }}>
      {loading ? <LoadingScreen /> : <Screen centered><View style={{ gap: 20, width: '100%' }}>
        <Text accessibilityRole="header" style={{ fontSize: 26, lineHeight: 34 }}>{unpaired ? 'Your space isn’t paired yet' : 'We couldn’t load your space'}</Text>
        <Text>{unpaired ? 'Ask the admin to run the seed script' : friendlyError(error)}</Text>
        <Button title="Try again" onPress={() => { void session.refetch(); void profile.refetch(); }} />
        <Button title="Sign out" onPress={() => { void supabase.auth.signOut({ scope: 'local' }).then(({ error: signOutError }) => { if (signOutError) setLogoutError(friendlyError(signOutError)); }); }} />
        {!!logoutError && <Text accessibilityRole="alert">{logoutError}</Text>}
      </View></Screen>}
    </View>}
  </View>;
}

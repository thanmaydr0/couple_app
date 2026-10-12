import { router, Stack } from 'expo-router';
import { Screen, Header, EmptyState } from '@/ui';
export function ComingSoon({ title }: { title: string }) {
  return <Screen><Stack.Screen options={{ headerShown: false }} /><Header title={title} onBack={() => router.back()} /><EmptyState title="Coming soon" description="A little more us is on its way." /></Screen>;
}

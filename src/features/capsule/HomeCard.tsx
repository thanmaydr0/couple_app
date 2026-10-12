import { router } from 'expo-router';
import { Card, Text, PressableScale } from '@/ui';
import { useCapsules } from './useCapsules';
import { countdown } from './service';
/** Shared Home owner: render <CapsuleHomeCard /> inside the existing card stack. */
export function CapsuleHomeCard() {
  const { data, offline } = useCapsules();
  const next = data?.received.find(item => !item.opened_at);
  if (!next || !data) return null;
  return <PressableScale accessibilityRole="button" accessibilityLabel="Open Time Capsule" onPress={() => router.push('/us/capsule')}><Card><Text variant="title/S">Time Capsule</Text><Text>{offline ? 'Reconnect to check your next capsule' : `Next capsule · ${countdown(next.unlock_at, data.serverNow).toLowerCase()}`}</Text></Card></PressableScale>;
}

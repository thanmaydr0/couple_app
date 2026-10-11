import { type ComponentProps } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from './Screen';
import { Text } from './Text';
import { Button } from './Button';
import { Card } from './Card';
import { theme } from './theme';

const features: Record<string, { title: string; description: string; icon: ComponentProps<typeof Ionicons>['name'] }> = {
  chat: { title: 'Your conversations', description: 'A private place for your everyday messages. Messaging is coming in a future update.', icon: 'chatbubbles-outline' },
  memories: { title: 'Moments worth keeping', description: 'Your shared photos and videos will live here. The memories album is coming in a future update.', icon: 'images-outline' },
  watch: { title: 'Movie nights, together', description: 'Watch your favorite stories with your favorite person. Synchronized playback is coming in a future update.', icon: 'play-circle-outline' },
  games: { title: 'A little playful time', description: 'Choose a game to see what’s coming to your shared space.', icon: 'game-controller-outline' },
  chess: { title: 'Your next move', description: 'Challenge your partner to a game of chess. Shared games are coming in a future update.', icon: 'trophy-outline' },
  scribble: { title: 'Draw a little closer', description: 'A drawing and guessing game for the two of you. Scribble is coming in a future update.', icon: 'color-palette-outline' },
  calls: { title: 'Hear each other. See each other.', description: 'Voice and video calling are coming in a future update. No call has been placed.', icon: 'videocam-outline' },
};

export function TodoScreen({ feature }: { feature: string }) {
  const content = features[feature] ?? { title: 'Your shared space', description: 'This part of your space is coming in a future update.', icon: 'heart-outline' as const };
  return <Screen centered bottomInset><View style={{ width: '100%', gap: 24 }}>
    <Card style={{ alignItems: 'center', gap: 20, paddingVertical: 32 }}>
      <Ionicons name={content.icon} size={56} color={theme.colors.primary} />
      <Text accessibilityRole="header" style={{ fontSize: 28, lineHeight: 36, fontWeight: '700', textAlign: 'center' }}>{content.title}</Text>
      <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>{content.description}</Text>
      <Text style={{ color: theme.colors.primary }}>Coming soon</Text>
    </Card>
    {feature === 'games' && <View style={{ gap: 12 }}>
      <Button title="Chess" onPress={() => router.push('/games/chess')} />
      <Button title="Scribble" onPress={() => router.push('/games/scribble')} />
    </View>}
    <Button title="Back to our space" onPress={() => router.replace('/(tabs)')} />
  </View></Screen>;
}

import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { Button, Card, Screen, Text } from '@/ui';

export default function GamesScreen() {
  return <Screen><ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 24 }}>
    <Text style={{ fontSize: 28, lineHeight: 36, fontWeight: '700' }}>Play together</Text><Text>A shared board, a little competition, and time for just the two of you.</Text>
    <Card style={{ gap: 12 }}><Text style={{ fontSize: 28 }}>♟ Chess</Text><Text>Your next move is waiting. Play live or pick up where you left off.</Text><Button title="Open Chess" onPress={() => router.push('/games/chess')} /></Card>
    <Card style={{ gap: 12 }}><Text style={{ fontSize: 28 }}>✎ Scribble</Text><Text>Coming soon · Draw, guess, and laugh together.</Text><Button title="Scribble · Coming soon" onPress={() => router.push('/games/scribble')} /></Card>
  </ScrollView></Screen>;
}

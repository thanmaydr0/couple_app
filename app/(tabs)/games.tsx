import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Header, PressableScale, Screen, Text } from '@/ui';
import { StaggerList } from '@/motion';
import { useTheme } from '@/theme';

export default function GamesScreen() {
  const { spacing, colors, geometry, radius } = useTheme();
  return <Screen><ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
    <Header title="Play together" subtitle="A little friendly rivalry. A little more us." />
    <StaggerList style={{ gap: spacing.lg }}>
      {([{ title: 'Chess', icon: 'grid-outline', description: 'Your next move is waiting. Play live or pick up where you left off.', route: '/games/chess', tag: 'TAKE YOUR TIME' }, { title: 'Scribble', icon: 'brush-outline', description: 'Draw a secret word. Guess a little faster. Laugh a lot together.', route: '/games/scribble', tag: 'MAKE A LITTLE MESS' }] as const).map(game => <PressableScale key={game.title} accessibilityRole="button" accessibilityLabel={`Open ${game.title}`} onPress={() => router.push(game.route)}>
        <Card style={{ gap: spacing.lg, padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}><Ionicons name={game.icon} size={geometry.touch} color={colors.primary} /></View><Text variant="caption" color="textSecondary">FOR TWO</Text></View>
          <View style={{ gap: spacing.sm }}><Text variant="caption" color="textSecondary">{game.tag}</Text><Text variant="display/M">{game.title}</Text><Text color="textSecondary">{game.description}</Text></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: geometry.touch }}><Text variant="label" color="primary">Open {game.title}</Text><Ionicons name="arrow-forward" size={geometry.icon} color={colors.primary} /></View>
        </Card>
      </PressableScale>)}
    </StaggerList>
  </ScrollView></Screen>;
}

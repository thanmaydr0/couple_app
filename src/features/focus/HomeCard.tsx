import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Card, Text, PressableScale } from '@/ui';
import { statistics } from './clock';
import { useFocus } from './useFocus';
export function HomeCard() { const f = useFocus(); const { spacing } = useTheme(); const stats = statistics(f.query.data?.logs ?? [], f.userId, f.now); return <Card style={{ gap: spacing.sm }}><PressableScale accessibilityRole="button" onPress={() => router.push('/us/focus')} style={{ gap: spacing.sm, padding: spacing.sm }}><Text variant="title/M">Focus together</Text><Text color="textSecondary">{f.offline ? 'Offline · Saved garden' : f.query.isPending ? 'Loading your garden…' : f.query.error ? 'Open to reconnect' : `${stats.streak} day streak · ${f.session?.status === 'active' ? (f.joined ? 'Your room is running' : 'Your partner started · Join') : 'Grow a little, together'}`}</Text></PressableScale></Card>; }

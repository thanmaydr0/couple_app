import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Card, Text, PressableScale } from '@/ui';
import { statistics } from './clock';
import { useFocus } from './useFocus';
export function HomeCard() { const f = useFocus(); const { spacing } = useTheme(); const stats = statistics(f.query.data?.logs ?? [], f.userId, f.now); return <PressableScale accessibilityRole="button" onPress={() => router.push('/us/focus')}><Card variant="elevated" style={{ gap: spacing.xs }}><Text variant="caption" color="primary">FOCUS TOGETHER</Text><Text variant="title/M">Focus room & garden</Text><Text color="textSecondary">{f.offline ? 'Offline · Saved garden' : f.query.isPending ? 'Loading your garden…' : f.query.error ? 'Open to reconnect' : `${stats.streak} day streak · ${f.session?.status === 'active' ? (f.joined ? 'Your room is running' : 'Your partner started · Join') : 'Grow a little, together'}`}</Text></Card></PressableScale>; }

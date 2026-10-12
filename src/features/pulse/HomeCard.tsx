import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Card, Text, Button } from '@/ui';
import { usePulse } from './usePulse';
import { questionFor } from './calendar';
import { HeartButton } from './HeartButton';
import { TheirDay } from './TheirDay';
export function HomeCard() {
  const pulse = usePulse(); const { spacing } = useTheme(); const partner = pulse.data?.statuses.find(s => s.user_id !== pulse.userId);
  return <Card style={{ gap: spacing.md }}><Text variant="title/M">A little Pulse</Text><Text>{questionFor(pulse.day)}</Text><Text color="textSecondary">{pulse.offline ? 'Offline · saved check-in' : pulse.error ? 'Pulse unavailable · open to retry' : pulse.isPending ? 'Loading check-ins…' : partner ? `${partner.mood} · ${partner.availability} · ${new Date(partner.updated_at).toLocaleTimeString()}` : 'No partner check-in yet'}</Text><Button title="Open our daily question" onPress={() => router.push('/us/pulse')} /><HeartButton disabled={pulse.offline || !pulse.coupleId || pulse.isPending || pulse.isError} /><TheirDay mini now={pulse.now} offline={pulse.offline} /></Card>;
}

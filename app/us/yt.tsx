import { useLocalSearchParams } from 'expo-router';
import { YouTubeEntry } from '@/features/yt';
export default function YouTubeRoute() {
  const params = useLocalSearchParams<{ text?: string; url?: string }>();
  return <YouTubeEntry initialText={typeof params.text === 'string' ? params.text : typeof params.url === 'string' ? params.url : ''} />;
}

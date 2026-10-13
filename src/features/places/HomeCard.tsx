import { router } from 'expo-router';
import { useProfile } from '@/lib/hooks';
import { Card, ListItem } from '@/ui';
import { useHomes } from './data';
import { haversine } from './geo';
export function HomeCard() {
  const profile=useProfile(); const homes=useHomes(profile.data?.couple_id,true);
  const first=homes.data?.[0], second=homes.data?.[1];
  // Profile coordinates exist only after each partner opts in via Settings.
  return <Card><ListItem title={first && second ? `${Math.round(haversine(first,second)).toLocaleString()} km between us` : 'Our Places'} subtitle="A world of places we love, and places still to come" onPress={()=>router.push('/us/places')} /></Card>;
}

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Button, Card, Text, PressableScale } from '@/ui';
import { useTheme } from '@/theme';
import { useProfile, useCouple } from '@/lib/hooks';
import { useStory } from './useStory';
import { storyTimezone } from './timezone';
import { cancelStoryNotifications, reminderKey, rescheduleReminders } from './notifications';
export function HomeCard() {
  const story = useStory('all', false); const {spacing} = useTheme();
  const memory = story.today.data?.[0];
  const years = memory ? Number(story.day.slice(0,4))-Number(new Intl.DateTimeFormat('en',{timeZone:story.timezone,year:'numeric'}).format(new Date(memory.at))) : 0;
  return <View style={{gap:spacing.md}}>{memory && <PressableScale accessibilityRole="button" onPress={()=>router.push('/us/story')}><Card style={{gap:spacing.sm}}><Text variant="label" color="primary">ON THIS DAY</Text><Text variant="title/M">{years} {years===1?'year':'years'} ago today…</Text><Text>{memory.title}</Text></Card></PressableScale>}{story.day.slice(5,7)==='12' && <PressableScale accessibilityRole="button" onPress={()=>router.push({pathname:'/us/story',params:{wrapped:story.day.slice(0,4)}})}><Card><Text variant="title/M">Us in {story.day.slice(0,4)}</Text><Text color="textSecondary">Your year, one little moment at a time. Open Wrapped →</Text></Card></PressableScale>}{story.notificationError && <Text variant="caption" color="textSecondary">{story.notificationError}</Text>}</View>;
}
export function SettingsSection() {
  const profile = useProfile(); const couple = useCouple(); const user = profile.data?.id; const id = profile.data?.couple_id;
  const [enabled,setEnabled] = useState(false); const [busy,setBusy] = useState(false); const [error,setError] = useState<string>(); const {spacing} = useTheme();
  useEffect(()=>{let live=true;setEnabled(false);if(user) void AsyncStorage.getItem(reminderKey(user)).then(v=>{if(live)setEnabled(v==='true');}).catch(()=>setError('Could not read reminder preference.'));return()=>{live=false;};},[user]);
  const toggle = async()=>{
    if(!user||!id||busy)return;setBusy(true);setError(undefined);
    try {
      const next=!enabled;
      if(next){await Notifications.setNotificationChannelAsync('story-memories',{name:'On this day',importance:Notifications.AndroidImportance.DEFAULT});const p=await Notifications.requestPermissionsAsync();if(!p.granted)throw new Error('Allow notifications in Android settings to enable memories.');}
      await AsyncStorage.setItem(reminderKey(user),String(next));setEnabled(next);
      if(next) await rescheduleReminders(user,id,storyTimezone(couple.data));else await cancelStoryNotifications();
    }catch(e){setError(e instanceof Error?e.message:'Could not update reminders.');}finally{setBusy(false);}
  };
  return <Card style={{gap:spacing.sm}}><Text variant="title/S">Memory reminders · {enabled?'On':'Off'}</Text><Text color="textSecondary">At 9:00 in your couple timezone, only on days with memories. Refreshes the next 30 days whenever the app opens.</Text><Button title={busy?'Updating…':enabled?'Turn reminders off':'Enable memory reminders'} disabled={busy||!id||!couple.isSuccess} onPress={()=>void toggle()}/>{error&&<Text accessibilityLiveRegion="polite" color="danger">{error}</Text>}</Card>;
}

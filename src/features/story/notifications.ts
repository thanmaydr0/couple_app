import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { memoryDays } from './api';
import { localDay, wallTime, storyTimezone } from './timezone';

const prefix = 'story-on-this-day:';
let queue = Promise.resolve();
let lastPlan: {key:string;at:number}|undefined;
export const reminderKey = (user: string) => `${prefix}enabled:${user}`;
async function cancelScheduled() {
  lastPlan=undefined;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.filter(n=>n.identifier.startsWith(prefix)).map(n=>Notifications.cancelScheduledNotificationAsync(n.identifier)));
}
export function cancelStoryNotifications() {
  queue=queue.catch(()=>{}).then(cancelScheduled);return queue;
}
// Convert a wall-clock time in an IANA zone into an instant, including DST.
export const nineAM = (day: string, timezone: string) => wallTime(day, timezone);
export function rescheduleReminders(user: string, couple: string, timezone: string) {
  queue = queue.catch(()=>{}).then(async()=>{
    const { data:{session} } = await supabase.auth.getSession();
    if (session?.user.id !== user) return;
    if (await AsyncStorage.getItem(reminderKey(user)) !== 'true') { await cancelScheduled(); return; }
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) { await cancelScheduled(); return; }
    const key=`${user}:${couple}:${timezone}:${localDay(new Date(),timezone)}`;
    if(lastPlan?.key===key&&Date.now()-lastPlan.at<60000)return;
    // Drop another account/couple's plan even when this account is offline.
    const previous=await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(previous.filter(n=>n.identifier.startsWith(prefix)&&!n.identifier.startsWith(`${prefix}${user}:${couple}:`)).map(n=>Notifications.cancelScheduledNotificationAsync(n.identifier)));
    // Fetch before cancelling so an offline restart retains the last valid plan.
    const memories = await memoryDays(timezone);
    await cancelScheduled();
    await Notifications.setNotificationChannelAsync('story-memories',{name:'On this day',importance:Notifications.AndroidImportance.DEFAULT});
    const now = new Date(); const today = localDay(now,timezone);
    for (let offset=0;offset<30;offset++) {
      const day = new Date(Date.parse(`${today}T12:00:00Z`)+offset*86400000).toISOString().slice(0,10);
      if (!memories.some(m=>m.day===day.slice(5) && m.year<Number(day.slice(0,4)))) continue;
      const date = nineAM(day,timezone); if (date<=now) continue;
      const { data:{session:current} } = await supabase.auth.getSession();
      if (current?.user.id!==user || await AsyncStorage.getItem(reminderKey(user))!=='true') { await cancelScheduled(); return; }
      await Notifications.scheduleNotificationAsync({identifier:`${prefix}${user}:${couple}:${day}`,content:{title:'On this day, with you',body:'A memory from another year is waiting in Story of Us.',data:{route:'/us/story',day}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date,channelId:'story-memories'}});
    }
    lastPlan={key,at:Date.now()};
  });
  return queue;
}
let startupInstalled=false;
// The existing root PushProvider imports the feature registry, which imports
// story/config. Install once there so deep-link launches also refresh reminders.
export function installStoryStartup() {
  if(startupInstalled||!isSupabaseConfigured)return;startupInstalled=true;
  const refresh=async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){await cancelStoryNotifications();return;}
    const {data:profile,error:profileError}=await supabase.from('profiles').select('couple_id').eq('id',session.user.id).maybeSingle();
    if(profileError)throw profileError;
    if(!profile?.couple_id){await cancelStoryNotifications();return;}
    const {data:couple,error:coupleError}=await supabase.from('couples').select('*').eq('id',profile.couple_id).single();
    if(coupleError)throw coupleError;
    await rescheduleReminders(session.user.id,profile.couple_id,storyTimezone(couple));
  };
  const run=()=>{void refresh().catch(()=>{/* Home/Story expose retry errors; retain a valid offline plan. */});};
  // Never await another auth call inside onAuthStateChange's auth lock.
  supabase.auth.onAuthStateChange(event=>{if(event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='SIGNED_OUT')setTimeout(run,0);});
  AppState.addEventListener('change',state=>{if(state==='active')run();});
}
export function useStoryClock(user?: string, couple?: string, timezone='UTC') {
  const [day,setDay] = useState(()=>localDay(new Date(),timezone));
  const [notificationError,setNotificationError] = useState<string>();
  useEffect(()=>{
    const refresh = () => {
      setDay(localDay(new Date(),timezone));
      if (user && couple) void rescheduleReminders(user,couple,timezone).then(()=>setNotificationError(undefined)).catch(()=>setNotificationError('Memory reminders could not refresh. Open Story when you are connected.'));
    };
    refresh();
    const subscription = AppState.addEventListener('change',state=>{if(state==='active') refresh();});
    const timer = setInterval(()=>{if(AppState.currentState==='active') setDay(localDay(new Date(),timezone));},60000);
    const {data:{subscription:auth}} = supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT') void cancelStoryNotifications().catch(()=>{});});
    return ()=>{subscription.remove();auth.unsubscribe();clearInterval(timer);};
  },[user,couple,timezone]);
  return {day,notificationError};
}

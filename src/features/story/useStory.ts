import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { useCouple, useProfile } from '@/lib/hooks';
import { feed, summary } from './api';
import { milestones } from './model';
import { useStoryClock } from './notifications';
import type { Entry, StoryFilter } from './types';
import { storyTimezone } from './timezone';
export function useStory(filter: StoryFilter = 'all', includeTimeline = true) {
  const profile = useProfile(); const couple = useCouple();
  const id = profile.data?.couple_id; const user = profile.data?.id;
  const timezone = storyTimezone(couple.data);
  const ready = !!id && couple.isSuccess;
  const {day,notificationError} = useStoryClock(couple.isSuccess?user:undefined,couple.isSuccess?id??undefined:undefined,timezone);
  const [offline,setOffline] = useState(false);
  useEffect(()=>NetInfo.addEventListener(state=>setOffline(state.isConnected===false || state.isInternetReachable===false)),[]);
  const stats = useQuery({queryKey:['story-summary',user,id,day,timezone],enabled:ready&&includeTimeline,queryFn:({signal})=>summary(timezone,undefined,signal)});
  const today = useQuery({queryKey:['story-today',user,id,day,timezone],enabled:ready,queryFn:({signal})=>feed(timezone,'all',undefined,day,signal)});
  const timeline = useInfiniteQuery({queryKey:['story-feed',user,id,filter,timezone],enabled:includeTimeline&&ready&&filter!=='milestone',initialPageParam:undefined as Pick<Entry,'at'|'id'>|undefined,queryFn:({pageParam,signal})=>feed(timezone,filter,pageParam,undefined,signal),getNextPageParam:(page)=>page.length===40 ? {at:page[page.length-1]!.at,id:page[page.length-1]!.id} : undefined});
  const unlocked = milestones(stats.data??{},couple.data?.anniversary,new Date(),timezone);
  const source = timeline.data?.pages.flat()??[];
  // Do not insert older computed milestones ahead of an unloaded source page.
  const oldest = source[source.length-1]?.at;
  const visibleMilestones = unlocked.filter(m=>!timeline.hasNextPage || !oldest || Date.parse(m.at)>=Date.parse(oldest));
  const entries = (filter==='milestone' ? unlocked : [...source,...(filter==='all'?visibleMilestones:[])]).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||b.id.localeCompare(a.id));
  return {profile,couple,id,user,timezone,day,offline,stats,today,timeline,unlocked,entries,notificationError};
}

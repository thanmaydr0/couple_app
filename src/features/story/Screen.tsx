import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, router } from 'expo-router';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { Button, Card, EmptyState, ErrorState, Header, PressableScale, Screen, Text } from '@/ui';
import { useTheme } from '@/theme';
import { Burst, FadeInView, ParallaxHeader, Skeleton } from '@/motion';
import { useStory } from './useStory';
import { SettingsSection } from './HomeCard';
import { MemoryImage } from './MemoryImage';
import { Wrapped } from './Wrapped';
import type { Entry, StoryFilter } from './types';

type Row = {type:'chapter';id:string;title:string}|{type:'memory';id:string;entry:Entry};
const filters: {id:StoryFilter;title:string}[]=[{id:'all',title:'All'},{id:'media',title:'Memories'},{id:'milestone',title:'Milestones'},{id:'list',title:'Completed dreams'},{id:'capsule',title:'Capsules'},{id:'event',title:'Dates'},{id:'game',title:'Play'}];
function MemoryCard({entry,timezone}:{entry:Entry;timezone:string}) {
  const {spacing,geometry,colors}=useTheme();const [expanded,setExpanded]=useState(false);const [burst,setBurst]=useState(0);
  return <PressableScale accessibilityRole="button" accessibilityLabel={`${entry.title}. ${expanded?'Collapse':'Expand'} memory`} accessibilityState={{expanded}} onPress={()=>{setExpanded(p=>!p);if(entry.kind==='milestone')setBurst(n=>n+1);}} style={{minHeight:geometry.touch}}><Card style={{gap:spacing.sm,overflow:'hidden'}}><Text variant="caption" color="primary">{entry.kind.toUpperCase()} · {new Date(entry.at).toLocaleDateString(undefined,{timeZone:timezone,day:'numeric',month:'short',year:'numeric'})}</Text><Text variant="title/S">{entry.title}</Text>{expanded&&<>{entry.detail&&<Text color="textSecondary">{entry.detail.includes('-')&&entry.kind==='game'?'A shared victory':entry.detail}</Text>}{entry.path&&<MemoryImage path={entry.path}/>}</>}<Text variant="caption" color="textSecondary">{expanded?'Show less':'Open this moment'}</Text>{entry.kind==='milestone'&&burst>0&&<View pointerEvents="none" style={{position:'absolute',top:-geometry.touch,left:-geometry.touch}}><Burst trigger={burst}/></View>}</Card><View style={{position:'absolute',left:-spacing.sm,top:spacing.lg,width:geometry.dot,height:geometry.dot,borderRadius:geometry.dot,backgroundColor:colors.primary}}/></PressableScale>;
}
export default function StoryScreen() {
  const params=useLocalSearchParams<{wrapped?:string}>();const [filter,setFilter]=useState<StoryFilter>('all');const story=useStory(filter);const currentYear=Number(story.day.slice(0,4));
  const requested=Number(params.wrapped);const [wrappedYear,setWrappedYear]=useState<number|undefined>(Number.isInteger(requested)&&requested>=1900&&requested<=currentYear?requested:undefined);
  const [year,setYear]=useState(currentYear);
  const {spacing,geometry,colors,radius}=useTheme();const scroll=useSharedValue(0);const boundedScroll=useDerivedValue(()=>Math.min(scroll.value,geometry.touch));
  const rows=useMemo(()=>{
    const result:Row[]=[];let last='';
    for(const entry of story.entries){const month=new Date(entry.at).toLocaleDateString('en',{timeZone:story.timezone,month:'long',year:'numeric'});if(month!==last){result.push({type:'chapter',id:`chapter:${month}`,title:month});last=month;}result.push({type:'memory',id:entry.id,entry});}return result;
  },[story.entries,story.timezone]);
  const refresh=()=>{void story.stats.refetch();void story.today.refetch();if(filter!=='milestone')void story.timeline.refetch();};
  const header=<View style={{gap:spacing.lg,paddingBottom:spacing.lg}}>
    {story.offline&&<Card><Text accessibilityLiveRegion="polite">You’re offline. Showing memories already loaded on this phone.</Text></Card>}
    {story.notificationError&&<Text color="textSecondary">{story.notificationError}</Text>}
    <View style={{gap:spacing.sm}}><Text variant="display/M">Our little forever.</Text><Text color="textSecondary">The firsts, the ordinary days, the moments that became us.</Text></View>
    <View style={{gap:spacing.sm}}><Text variant="title/M">On this day</Text>{story.today.isPending?<Skeleton/>:story.today.isError?<ErrorState description="Today’s memories could not load." onRetry={()=>void story.today.refetch()}/>:story.today.data?.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:spacing.md,paddingLeft:spacing.sm}}>{story.today.data.map(entry=><View key={entry.id} style={{width:geometry.touch*6}}><Text variant="label" color="primary">{Number(story.day.slice(0,4))-Number(new Intl.DateTimeFormat('en',{timeZone:story.timezone,year:'numeric'}).format(new Date(entry.at)))} years ago today…</Text><MemoryCard entry={entry} timezone={story.timezone}/></View>)}</ScrollView>:<Text color="textSecondary">No memories from this date in earlier years. You’re making tomorrow’s memories today.</Text>}</View>
    <View style={{gap:spacing.sm}}><Text variant="title/M">Milestones</Text>{story.stats.isPending?<Skeleton/>:story.stats.isError?<ErrorState description="Milestones could not load." onRetry={()=>void story.stats.refetch()}/>:story.unlocked.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:spacing.md,paddingLeft:spacing.sm}}>{story.unlocked.map(entry=><View key={entry.id} style={{width:geometry.touch*6}}><MemoryCard entry={entry} timezone={story.timezone}/></View>)}</ScrollView>:<Text color="textSecondary">Your firsts are ahead of you. Set your anniversary in Settings to include your days together.</Text>}</View>
    <Card style={{gap:spacing.md}}><Text variant="label" color="primary">YOUR YEAR TOGETHER</Text><Text variant="display/M">Us in {year}</Text><Text color="textSecondary">A few numbers. A thousand little feelings.</Text><View style={{flexDirection:'row',gap:spacing.sm,flexWrap:'wrap'}}><Button title="Earlier year" disabled={year<=1900} onPress={()=>setYear(y=>y-1)}/><Button title="Later year" disabled={year>=currentYear} onPress={()=>setYear(y=>y+1)}/></View><Button title="Open Wrapped" disabled={!story.id} onPress={()=>setWrappedYear(year)}/></Card>
    <SettingsSection/>
    <Text variant="title/M">Our story timeline</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:spacing.sm}}>{filters.map(f=><PressableScale key={f.id} accessibilityRole="button" accessibilityState={{selected:filter===f.id}} onPress={()=>setFilter(f.id)} style={{minHeight:geometry.touch,justifyContent:'center',paddingHorizontal:spacing.md,borderRadius:radius.pill,backgroundColor:filter===f.id?colors.primary:colors.surface}}><Text color={filter===f.id?'primaryContrast':'textPrimary'}>{f.title}</Text></PressableScale>)}</ScrollView>
  </View>;
  if(story.profile.isError||story.couple.isError)return <Screen><Header title="Story of Us" onBack={()=>router.back()}/><ErrorState description="Your couple could not load. Check your connection." onRetry={()=>{void story.profile.refetch();void story.couple.refetch();}}/></Screen>;
  if(story.profile.isPending||!!story.id&&story.couple.isPending)return <Screen><Header title="Story of Us"/><Skeleton/></Screen>;
  if(!story.id)return <Screen><Header title="Story of Us" onBack={()=>router.back()}/><EmptyState title="A story for two" description="Pair with your partner to begin your shared story."/></Screen>;
  return <Screen bottomInset><Header title="Story of Us" subtitle="Every chapter, together" onBack={()=>router.back()} right={<Button title="Refresh" variant="ghost" onPress={refresh}/>}/><FlashList data={rows} keyExtractor={row=>row.id} getItemType={row=>row.type} onScroll={event=>{scroll.value=event.nativeEvent.contentOffset.y;}} ListHeaderComponent={header} renderItem={({item,index})=>{
    if(item.type==='chapter')return <ParallaxHeader scrollY={boundedScroll} style={{paddingVertical:spacing.md,backgroundColor:colors.bg}}><Text variant="title/M">{item.title}</Text></ParallaxHeader>;
    const content=<View style={{paddingLeft:spacing.md,paddingBottom:spacing.md,borderLeftWidth:geometry.stroke,borderLeftColor:colors.border}}><MemoryCard key={item.id} entry={item.entry} timezone={story.timezone}/></View>;
    return index<geometry.firstScreenful?<FadeInView>{content}</FadeInView>:content;
  }} ListEmptyComponent={filter!=='milestone'&&story.timeline.isPending?<Skeleton/>:filter!=='milestone'&&story.timeline.isError?<ErrorState description="The timeline could not load." onRetry={()=>void story.timeline.refetch()}/>:<EmptyState title="A chapter waiting to happen" description="Your shared memories will appear here."/>} ListFooterComponent={<View style={{paddingVertical:spacing.lg,gap:spacing.sm}}>{story.timeline.isFetchNextPageError&&<ErrorState description="The next chapter could not load." onRetry={()=>void story.timeline.fetchNextPage()}/>} {filter!=='milestone'&&story.timeline.hasNextPage&&<Button title={story.timeline.isFetchingNextPage?'Loading…':'Load older chapters'} disabled={story.timeline.isFetchingNextPage} onPress={()=>void story.timeline.fetchNextPage()}/>}</View>} onEndReachedThreshold={0.5} onEndReached={()=>{if(filter!=='milestone'&&story.timeline.hasNextPage&&!story.timeline.isFetching&&!story.timeline.isFetchNextPageError)void story.timeline.fetchNextPage();}}/>{wrappedYear!==undefined&&story.id&&<Wrapped year={wrappedYear} timezone={story.timezone} couple={story.id} onClose={()=>{setWrappedYear(undefined);if(params.wrapped)router.setParams({wrapped:undefined});}}/>}</Screen>;
}

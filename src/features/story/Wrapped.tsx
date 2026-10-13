import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Modal, ScrollView, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { makeImageFromView } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/theme';
import { useMotion, motionTokens } from '@/motion';
import { Button, ErrorState, Header, PressableScale, Screen, Text } from '@/ui';
import { usePartner, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { summary } from './api';
import { cachedEmoji, recapCards } from './model';
import { entrySchema, type RecapCard } from './types';
import { MemoryImage } from './MemoryImage';
import { localDay } from './timezone';

function Artwork({card,active}:{card:RecapCard;active:boolean}) {
  const {colors,geometry,spacing,typography}=useTheme();const motion=useMotion();const phase=useSharedValue(0);
  useEffect(()=>{phase.value=0;if(active&&motion.level==='full') phase.value=withRepeat(withTiming(1,{duration:motion.duration('drift')}),-1,true);return()=>cancelAnimation(phase);},[card.id,motion.level,phase,active]);
  const animated=useAnimatedStyle(()=>({transform:[{rotate:`${(card.clock?0:phase.value)*geometry.parallax*360}deg`},{scale:card.clock?1+phase.value*geometry.parallax/10:1}]}));
  const size=geometry.touch*4;const center=size/2;const r=center-spacing.md;
  const max=Math.max(1,...(card.clock??[]).map(g=>g.count));
  return <Animated.View accessible accessibilityLabel={card.clock?'Clock chart: '+card.clock.map(g=>`${g.key}:00, ${g.count} messages`).join('; '):`${card.title} illustration`} style={[{alignSelf:'center',width:size,height:size},animated]}><Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><Circle cx={center} cy={center} r={r} fill={colors.surfaceAlt} stroke={colors.border} strokeWidth={geometry.stroke}/>{Array.from({length:24},(_,i)=>{
    const angle=(i/24)*Math.PI*2-Math.PI/2;const count=card.clock?.find(g=>Number(g.key)===i)?.count??0;const length=card.clock?spacing.xs+(count/max)*spacing.xl:spacing.sm+(i%4)*spacing.xs;
    return <Line key={i} x1={center+Math.cos(angle)*(r-length)} y1={center+Math.sin(angle)*(r-length)} x2={center+Math.cos(angle)*(r-spacing.xs)} y2={center+Math.sin(angle)*(r-spacing.xs)} stroke={i%2?colors.primary:colors.accent} strokeWidth={geometry.stroke} strokeLinecap="round"/>;
  })}<Circle cx={center} cy={center} r={spacing.sm} fill={colors.primary}/>{card.clock&&<><Line x1={center} y1={center} x2={center} y2={spacing.xl} stroke={colors.textPrimary} strokeWidth={geometry.stroke}/>{[0,6,12,18].map(hour=>{const angle=hour/24*Math.PI*2-Math.PI/2;return <SvgText key={hour} x={center+Math.cos(angle)*(r+spacing.xs)} y={center+Math.sin(angle)*(r+spacing.xs)} textAnchor="middle" alignmentBaseline="middle" fill={colors.textPrimary} fontSize={typography.caption.fontSize}>{String(hour).padStart(2,'0')}</SvgText>;})}</>}</Svg></Animated.View>;
}
export function Wrapped({year,timezone,couple,onClose}:{year:number;timezone:string;couple:string;onClose:()=>void}) {
  const {colors,spacing,radius,geometry}=useTheme();const motion=useMotion();const client=useQueryClient();const profile=useProfile();const partner=usePartner();
  const stats=useQuery({queryKey:['story-wrapped',profile.data?.id,couple,year,timezone],queryFn:({signal})=>summary(timezone,year,signal)});
  const photo=stats.data?.media?.photo_at;
  const memory=useQuery({queryKey:['story-top-memory',profile.data?.id,couple,year,photo],enabled:!!photo,queryFn:async({signal})=>{
    const {data,error}=await supabase.from('media').select('id,taken_at,caption,thumb_path,storage_path,kind').eq('couple_id',couple).eq('created_at',photo!).eq('kind','photo').order('id').limit(1).abortSignal(signal).maybeSingle();
    if(error)throw error;if(!data)return undefined;
    return entrySchema.parse({id:`media:${data.id}`,kind:'media',at:data.taken_at,title:data.caption??'Our first photo this year',detail:'photo',path:data.thumb_path??data.storage_path});
  }});
  const names:Record<string,string>={};if(profile.data)names[profile.data.id]=profile.data.display_name??'You';if(partner.data)names[partner.data.id]=partner.data.display_name??'Your partner';
  const cards=recapCards(stats.data??{},names,cachedEmoji(client,couple,year,timezone),memory.data);
  const [index,setIndex]=useState(0);const [paused,setPaused]=useState(false);const [background,setBackground]=useState(AppState.currentState!=='active');const [screenReader,setScreenReader]=useState(true);
  const [progress,setProgress]=useState(0);const [sharing,setSharing]=useState(false);const [status,setStatus]=useState<string>();const [imageReady,setImageReady]=useState(false);const capture=useRef<View>(null);
  const card=cards[index];const length=cards.length;const auto=!paused&&!sharing&&!background&&!screenReader&&motion.level!=='off'&&stats.isSuccess;
  useEffect(()=>{void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);const a=AccessibilityInfo.addEventListener('screenReaderChanged',setScreenReader);const b=AppState.addEventListener('change',state=>setBackground(state!=='active'));return()=>{a.remove();b.remove();};},[]);
  useEffect(()=>{setProgress(0);setStatus(undefined);},[index]);
  useEffect(()=>{
    if(!auto)return;let previous=Date.now();
    const timer=setInterval(()=>{const now=Date.now();const elapsed=now-previous;previous=now;setProgress(p=>Math.min(1,p+elapsed/(motionTokens.toast*2)));},motionTokens.base);
    return()=>clearInterval(timer);
  },[auto,index]);
  useEffect(()=>{if(progress>=1&&auto){if(index<length-1){setIndex(i=>i+1);setProgress(0);}else setPaused(true);}},[progress,index,length,auto]);
  const share=async()=>{
    if(sharing)return;setSharing(true);setStatus(undefined);let file:File|undefined;
    try {
      const permission=await MediaLibrary.requestPermissionsAsync(true,['photo']);if(!permission.granted)throw new Error('Gallery access is needed to save this card.');
      const image=await makeImageFromView(capture);if(!image)throw new Error('Could not capture this card.');
      file=new File(Paths.cache,`us-${year}-${card?.id}-${Date.now()}.png`);file.write(image.encodeToBytes());image.dispose();
      await MediaLibrary.Asset.create(file.uri);setStatus('Saved to your gallery.');
      if(await Sharing.isAvailableAsync())await Sharing.shareAsync(file.uri,{mimeType:'image/png',dialogTitle:`Us in ${year}`});
    }catch(error){setStatus(error instanceof Error?error.message:'Could not save this card.');}finally{if(file?.exists)file.delete();setSharing(false);}
  };
  return <Modal visible animationType={motion.level==='off'?'none':'fade'} presentationStyle="fullScreen" onRequestClose={onClose}><Screen bottomInset><Header title={`Us in ${year}`} subtitle={year===Number(localDay(new Date(),timezone).slice(0,4))?'Your year so far':'A year of little moments'} onBack={onClose}/>{stats.isPending?<Text>Gathering your year…</Text>:stats.isError?<ErrorState description="Your recap could not load. Reconnect and try again." onRetry={()=>void stats.refetch()}/>:card&&<>
    <View accessibilityRole="progressbar" accessibilityLabel={`Card ${index+1} of ${length}`} accessibilityValue={{min:1,max:length,now:index+1}} style={{flexDirection:'row',gap:spacing.xs,paddingBottom:spacing.md}}>{cards.map((c,i)=><View key={c.id} style={{flex:1,height:geometry.track,borderRadius:radius.pill,backgroundColor:colors.surfaceAlt,overflow:'hidden'}}><View style={{width:`${(i<index?1:i===index?progress:0)*100}%`,height:'100%',backgroundColor:colors.primary}}/></View>)}</View>
    <ScrollView contentContainerStyle={{flexGrow:1}}><PressableScale accessibilityRole="button" accessibilityLabel={paused?'Resume recap':'Pause recap'} onPress={()=>setPaused(p=>!p)} style={{flex:1}}><View ref={capture} collapsable={false} style={{flex:1,backgroundColor:colors.surface,borderRadius:radius.sheet,padding:spacing.lg,gap:spacing.lg,justifyContent:'center',minHeight:geometry.touch*9}}><Text variant="label" color="primary">US / {year}</Text><Artwork card={card} active={auto}/><Text variant="title/M">{card.title}</Text><Text variant="display/M">{card.value}</Text><Text color="textSecondary">{card.detail}</Text>{card.memory?.path&&<MemoryImage key={card.memory.path} path={card.memory.path} onReady={setImageReady}/>}<Text variant="caption" color="textSecondary">Story of Us · {index+1} / {length}</Text></View></PressableScale></ScrollView>
    <View style={{gap:spacing.sm,paddingTop:spacing.md}}><View style={{flexDirection:'row',gap:spacing.sm,flexWrap:'wrap'}}><Button title="Previous" disabled={index===0||sharing} onPress={()=>setIndex(i=>Math.max(0,i-1))}/><Button title={paused?'Play':'Pause'} disabled={sharing} onPress={()=>setPaused(p=>!p)}/><Button title={index===length-1?'Done':'Next'} disabled={sharing} onPress={()=>index===length-1?onClose():setIndex(i=>i+1)}/></View><Button title={sharing?'Saving…':'Save & share card'} disabled={sharing||memory.isFetching||!!card.memory?.path&&!imageReady} onPress={()=>void share()}/>{memory.isError&&<Button title="Retry top memory" onPress={()=>void memory.refetch()}/>} {status&&<Text accessibilityLiveRegion="polite">{status}</Text>}{(screenReader||motion.level==='off')&&<Text variant="caption" color="textSecondary">Use Next to move at your own pace.</Text>}</View>
  </>}</Screen></Modal>;
}

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/hooks';
import { Text } from '@/ui';
import { useTheme } from '@/theme';
export function MemoryImage({path,onReady}:{path:string;onReady?:(ready:boolean)=>void}) {
  const {spacing,radius,geometry} = useTheme(); const profile=useProfile();
  const [failed,setFailed]=useState(false);
  const [prefix]=path.split('/'); const valid=prefix===profile.data?.couple_id;
  const image=useQuery({queryKey:['story-image',profile.data?.id,path],enabled:valid,staleTime:40*60000,queryFn:async()=>{
    const {data,error}=await supabase.storage.from('media').createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;
  }});
  useEffect(()=>{setFailed(false);onReady?.(false);},[path,onReady]);
  useEffect(()=>{if(!valid||image.isError||failed)onReady?.(true);},[valid,image.isError,failed,onReady]);
  if(!valid||image.isError||failed)return <Text color="textSecondary">This memory’s preview is unavailable.</Text>;
  return <View style={{height:geometry.touch*4,borderRadius:radius.md,overflow:'hidden',marginTop:spacing.sm}}>{image.data?<Image accessibilityLabel="A shared photo memory" source={{uri:image.data}} style={{flex:1}} contentFit="cover" onLoad={()=>onReady?.(true)} onError={()=>setFailed(true)}/>:<Text>Loading memory…</Text>}</View>;
}

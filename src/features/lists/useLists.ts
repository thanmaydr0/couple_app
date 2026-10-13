import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useProfile, usePartner } from '@/lib/hooks';
import { useRealtimeTable } from '@/lib/data/useRealtimeTable';
import { featureSupabase } from '@/lib/data/feature-client';
import { seedLists } from './service';
import { claimPrefix, decodeItem, decodeList, type ListItem, type OurList } from './types';
export function useLists() {
 const profile=useProfile(); const partner=usePartner(); const user=profile.data?.id; const couple=profile.data?.couple_id;
 const lists=useRealtimeTable({table:'lists',decode:decodeList}); const items=useRealtimeTable({table:'list_items',decode:decodeItem,orderBy:'position',limit:2000});
 const seed=useQuery({queryKey:['lists-seed',couple,user],enabled:!!couple&&!lists.offline,queryFn:async()=>{await seedLists(); await lists.refetch(); return true;},staleTime:Infinity});
 const [error,setError]=useState(''); const [working,setWorking]=useState(false); const lock=useRef(false);
 const [removed,setRemoved]=useState<string[]>([]);
 useEffect(()=>{setRemoved([]);setError('');},[user,couple]);
 // Re-fetch visibility even when an RLS-hidden subscription cannot receive the old row's reveal.
 useEffect(()=>{const timer=setInterval(()=>{if(AppState.currentState==='active'&&!items.offline) void items.refetch();},30000);return()=>clearInterval(timer);},[couple,user,items.offline]);
 const run=async(work:()=>Promise<void>)=>{if(lock.current||items.offline) return false;lock.current=true;setWorking(true);setError('');try{await work();return true;}catch(e){setError(e instanceof Error?e.message:'Could not save. Try again.');return false;}finally{lock.current=false;setWorking(false);}};
 const create=(list:OurList,title:string,notes:string|null,url:string|null,hidden:string|null=null):ListItem=>({id:randomUUID(),couple_id:couple!,list_id:list.id,title,notes,url,added_by:user!,position:Math.max(0,...(items.data??[]).filter(i=>i.list_id===list.id).map(i=>i.position))+1024,done_at:null,done_by:null,rating_a:null,rating_b:null,photo_path:null,media_id:null,revealed_at:null,hidden_from:hidden,created_at:new Date().toISOString()});
 const remove=async(item:ListItem)=>{
  setRemoved(ids=>[...ids,item.id]);
  const {error:failure,data}=await featureSupabase.from('list_items').delete().eq('id',item.id).eq('couple_id',couple!).select('id');
  if(failure||!data?.length){setRemoved(ids=>ids.filter(id=>id!==item.id));throw new Error(failure?.message??'Item changed. Refresh and retry.');}
  await items.refetch(); setRemoved(ids=>ids.filter(id=>id!==item.id));
 };
 const claim=async(list:OurList,item:ListItem)=>{await items.insert(create(list,`Getting: ${item.title}`,null,`${claimPrefix}${item.id}`,item.added_by));};
 return {profile,partner,user,couple,lists,items,seed,error,working,run,create,remove,claim,rows:(items.data??[]).filter(i=>!removed.includes(i.id))};
}

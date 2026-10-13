import { useEffect, useId, useState } from 'react';
import { AppState } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import { usePartner, useProfile, useSession } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { loadWallet, walletTiming } from './service';
export function useWallet() {
 const profile=useProfile(); const session=useSession(); const partner=usePartner(); const uid=session.data?.user.id;
 const couple=profile.data?.id===uid ? profile.data?.couple_id : null;
 const network=useNetInfo(); const offline=network.isConnected===false || network.isInternetReachable===false;
 const [active,setActive]=useState(AppState.currentState==='active'); const token=useId();
 const query=useQuery({queryKey:['wallet',couple,uid],enabled:!!couple && !!uid && active && !offline,queryFn:()=>loadWallet(couple!),retry:1});
 const {refetch}=query;
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{setActive(state==='active'); if(state==='active' && couple) void refetch();});return()=>sub.remove();},[couple,refetch]);
 useEffect(()=>{
  if(!active || offline || !couple || !uid) return;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const refresh=()=>{if(!timer) timer=setTimeout(()=>{timer=undefined;void refetch();},walletTiming.invalidate);};
  let channel=supabase.channel(`wallet:${couple}:${uid}:${token}`);
  for(const table of ['wallet_expenses','wallet_settlements','wallet_goals','wallet_contributions','wallet_recurring']) channel=channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`couple_id=eq.${couple}`},refresh);
  channel.subscribe(status=>{if(status==='SUBSCRIBED') refresh();});
  return()=>{if(timer) clearTimeout(timer);void supabase.removeChannel(channel);};
 },[active,offline,couple,uid,token,refetch]);
 return {...query,offline,uid,couple,partner:partner.data,profile:profile.data,identityLoading:profile.isPending || session.isPending,identityError:profile.isError || partner.isError};
}

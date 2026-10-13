import * as Picker from 'expo-image-picker';
import * as Manipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import type { ListItem } from './types';
export async function seedLists() {
 const rpc = supabase.rpc.bind(supabase) as unknown as (name:'lists_seed')=>Promise<{error:{message:string}|null}>;
 const {error}=await rpc('lists_seed'); if(error) throw new Error(error.message);
}
export async function makeMemory(item:ListItem,user:string) {
 if (!item.done_at || (item.hidden_from && !item.revealed_at)) throw new Error('Reveal and complete this item before sharing a memory.');
 const {data:session}=await supabase.auth.getSession(); if(session.session?.user.id!==user) throw new Error('Account changed. Reopen Lists.');
 const {data:existing,error:lookup}=await supabase.from('media').select('id,storage_path').eq('id',item.id).maybeSingle();
 if(lookup) throw lookup; if(existing) return existing;
 const permission=await Picker.requestMediaLibraryPermissionsAsync(); if(!permission.granted) throw new Error('Allow photo access to make a memory.');
 const pick=await Picker.launchImageLibraryAsync({mediaTypes:['images'],quality:1}); if(pick.canceled) return null;
 const asset=pick.assets[0]; if(!asset) return null;
 const image=await Manipulator.manipulateAsync(asset.uri,[{resize:asset.width>=asset.height?{width:Math.min(2560,asset.width)}:{height:Math.min(2560,asset.height)}}],{compress:0.8,format:Manipulator.SaveFormat.JPEG});
 const thumb=await Manipulator.manipulateAsync(image.uri,[{resize:{width:480}}],{compress:0.7,format:Manipulator.SaveFormat.JPEG});
 const storage_path=`${item.couple_id}/photos/${item.id}.jpg`; const thumb_path=`${item.couple_id}/thumbs/${item.id}.jpg`;
 const bytes=await new File(image.uri).arrayBuffer(); if(bytes.byteLength>=50*1024*1024) throw new Error('Choose a smaller photo (under 50 MB).');
 for(const [path,body] of [[storage_path,bytes],[thumb_path,await new File(thumb.uri).arrayBuffer()]] as const) {
  const {error}=await supabase.storage.from('media').upload(path,body,{contentType:'image/jpeg',upsert:true}); if(error) throw error;
 }
 const {error}=await supabase.from('media').insert({id:item.id,couple_id:item.couple_id,uploader_id:user,kind:'photo',storage_path,thumb_path,taken_at:new Date().toISOString(),caption:item.title,width:image.width,height:image.height,size_bytes:bytes.byteLength});
 if(error) throw error;
 return {id:item.id,storage_path};
}

import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useTheme } from '@/theme';
import { StaggerList } from '@/motion';
import { BottomSheet, Button, Card, EmptyState, ErrorState, Header, OfflineBanner, PressableScale, Screen, Skeleton, Text, TextField, Toast } from '@/ui';
import { useLists } from './useLists';
import { Ceremony, ItemGesture, Picker, Progress } from './Presentation';
import { claimPrefix, moods, type ListItem, type Mood } from './types';
import { makeMemory } from './service';

export default function ListsScreen() {
 const {spacing,geometry}=useTheme(); const state=useLists(); const {lists,items,user,partner}=state;
 const [selection,setSelection]=useState(''); const [composer,setComposer]=useState(false); const [custom,setCustom]=useState(false);
 const [title,setTitle]=useState(''); const [notes,setNotes]=useState(''); const [url,setUrl]=useState(''); const [mood,setMood]=useState<Mood>('all');
 const [celebration,setCelebration]=useState<{item:ListItem;reveal:boolean;trigger:number}>(); const sequence=useRef(0);
 const [toast,setToast]=useState<{message:string;undo?:()=>void;commit?:()=>void}>(); const pending=useRef<(()=>void)|undefined>(undefined);
 const [pendingDelete,setPendingDelete]=useState<string>();
 useEffect(()=>()=>{pending.current?.();},[]);
 const selected=(lists.data??[]).find(l=>l.id===selection)??lists.data?.find(l=>l.kind==='bucket')??lists.data?.[0];
 const all=state.rows.filter(i=>!i.url?.startsWith(claimPrefix)&&i.id!==pendingDelete);
 const revealed=all.filter(i=>i.hidden_from===user&&!!i.revealed_at);
 const rows=(selection==='revealed'?revealed:all.filter(i=>i.list_id===selected?.id)).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
 const disabled=state.working||items.offline||!user||!state.couple;
 const isA=!!user&&!!partner.data&&user<partner.data.id;
 const finishToast=()=>{const commit=pending.current;pending.current=undefined;setToast(undefined);commit?.();};
 const show=(message:string,undo?:()=>void)=>{finishToast();setToast({message,undo});};
 const complete=(item:ListItem)=>{void state.run(async()=>{
  await items.update(item.id,{done_at:new Date().toISOString(),done_by:user!});
  setCelebration({item:{...item,done_at:new Date().toISOString(),done_by:user!},reveal:false,trigger:++sequence.current});
  show('One more little adventure, complete.',()=>{void state.run(async()=>{await items.update(item.id,{done_at:null,done_by:null,rating_a:null,rating_b:null});setCelebration(undefined);});});
 });};
 const remove=(item:ListItem)=>{
  finishToast();setPendingDelete(item.id);
  const commit=()=>{void state.remove(item).catch(e=>setToast({message:e instanceof Error?e.message:'Could not remove. Try again.'})).finally(()=>setPendingDelete(current=>current===item.id?undefined:current));}; pending.current=commit;
  setToast({message:'Removed. Undo is available until you dismiss this message.',undo:()=>{pending.current=undefined;setPendingDelete(undefined);},commit});
 };
 const move=(item:ListItem,offset:number)=>{if(!offset)return;const index=rows.findIndex(i=>i.id===item.id);const target=Math.max(0,Math.min(rows.length-1,index+offset));if(index===target)return;
  const reordered=[...rows];reordered.splice(index,1);reordered.splice(target,0,item);
    const before=reordered[target-1]?.position;const after=reordered[target+1]?.position;
  const position=before===undefined?(after??1024)-1024:after===undefined?before+1024:Math.floor((before+after)/2);
  void state.run(async()=>{
   if(Number.isSafeInteger(position)&&position>=-2147483648&&position<=2147483647&&(before===undefined||position>before)&&(after===undefined||position<after))await items.update(item.id,{position});
   else for(let i=0;i<reordered.length;i++)if(reordered[i]!.position!==(i+1)*1024)await items.update(reordered[i]!.id,{position:(i+1)*1024});
  });
 };
 const add=()=>{void state.run(async()=>{
  if(custom){if(!title.trim())throw new Error('Give your list a name.');await lists.insert({id:randomUUID(),couple_id:state.couple!,kind:'custom',title:title.trim(),emoji:'✨',created_by:user!,created_at:new Date().toISOString()});}
  else {
   if(!selected)throw new Error('Select a list first.');
   if(!title.trim()&&!url.trim())throw new Error('Add an idea or a link.');
   if(url.trim()&&!/^https?:\/\//i.test(url.trim()))throw new Error('Use an https:// or http:// link.');
   if(selected.kind==='surprise'&&!partner.data)throw new Error('Link your partner before planning a surprise.');
   await items.insert(state.create(selected,title.trim()||url.trim(),[notes.trim(),mood==='all'?'':`#${mood.replaceAll(' ','-')}`].filter(Boolean).join('\n')||null,url.trim()||null,selected.kind==='surprise'?partner.data!.id:null));
  }
  setComposer(false);setTitle('');setNotes('');setUrl('');
 });};
 const reveal=(item:ListItem)=>{void state.run(async()=>{await items.update(item.id,{revealed_at:new Date().toISOString()});setCelebration({item,reveal:true,trigger:++sequence.current});});};
 const claim=(item:ListItem)=>{if(!selected)return;const existing=state.rows.find(i=>i.url===claimPrefix+item.id);void state.run(async()=>{if(existing)await state.remove(existing);else await state.claim(selected,item);});};
 const memory=(item:ListItem)=>{void state.run(async()=>{const saved=await makeMemory(item,user!);if(saved){await items.update(item.id,{media_id:saved.id,photo_path:saved.storage_path});show('Saved to Memories. A little piece of your story.');setCelebration(undefined);}});};
 return <Screen bottomInset><Header title="Our Lists" subtitle="Little dreams. Lovely plans. More us." onBack={()=>router.back()}/>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:spacing.md,paddingBottom:spacing.s56}}>
   <OfflineBanner offline={items.offline} message="Offline · saved ideas are here. Reconnect to make changes."/>
   {(lists.isLoading||items.isLoading||state.seed.isLoading)&&<><Skeleton/><Skeleton/></>}
   {(lists.isError||items.isError||state.seed.isError||state.profile.isError||partner.isError)&&<ErrorState title="Our ideas need a moment" description="We couldn’t refresh everything. Your saved ideas are still here." onRetry={()=>{void lists.refetch();void items.refetch();void state.seed.refetch();void state.profile.refetch();void partner.refetch();}}/>}
   {!!state.error&&<Text color="danger" accessibilityRole="alert">{state.error}</Text>}
   {!state.couple&&!state.profile.isLoading&&<EmptyState title="A list for two" description="Link your couple to start dreaming together."/>}
   <StaggerList style={{gap:spacing.sm}}>{(lists.data??[]).map(list=>{const data=all.filter(i=>i.list_id===list.id);return <PressableScale key={list.id} accessibilityRole="button" accessibilityState={{selected:selection!=='revealed'&&selected?.id===list.id}} style={{minHeight:geometry.touch}} onPress={()=>{setSelection(list.id);setMood('all');}}><Card style={{gap:spacing.sm}}><Text variant="title/S">{list.emoji} {list.title}{list.kind==='surprise'?' · Private':''}</Text><Progress done={data.filter(i=>!!i.done_at).length} total={data.length}/></Card></PressableScale>;})}</StaggerList>
   {!!revealed.length&&<Button title={`Revealed for you · ${revealed.length}`} variant="secondary" onPress={()=>setSelection('revealed')}/>}
   <Button title="Create a list" variant="secondary" disabled={disabled} onPress={()=>{setCustom(true);setTitle('');setComposer(true);}}/>
   {selected&&<>
    <Text variant="title/M">{selection==='revealed'?'A surprise, just for you':selected.title}</Text>
    {selected.kind==='surprise'&&selection!=='revealed'&&<Text color="textSecondary">🔒 Your partner cannot see these plans until you tap Reveal. Revealing shares the item permanently.</Text>}
    {selected.kind==='gifts'&&<Text color="textSecondary">Add your own wishes. Your partner can shop from them and privately claim a gift.</Text>}
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm}}>{moods.map(value=><Button key={value} title={value==='all'?'Any mood':value} variant={mood===value?'primary':'secondary'} onPress={()=>setMood(value)}/>)}</View>
    <Picker key={selection||selected.id} items={rows} mood={mood} disabled={disabled}/>
    {selection!=='revealed'&&<Button title="Add a little idea" disabled={disabled} onPress={()=>{setCustom(false);setTitle('');setNotes('');setUrl('');setComposer(true);}}/>}
    <Text variant="caption" color="textSecondary">Hold and drag to reorder. Swipe right to complete, left to remove. Buttons work too.</Text>
    {!rows.length&&<EmptyState title="Every adventure starts with a little idea" description="A sunset picnic? A film you keep meaning to see? Save the first spark."/>}
    <StaggerList style={{gap:spacing.md}}>{rows.map(item=><ItemGesture key={item.id} disabled={disabled} onMove={offset=>move(item,offset)} onComplete={()=>{if(!item.done_at)complete(item);}} onDelete={()=>remove(item)}><Card style={{gap:spacing.sm}}>
     <Text variant="title/S">{item.done_at?'✓ ':''}{item.title}</Text>
     {!!item.notes&&<Text color="textSecondary">{item.notes}</Text>}
     <Text variant="caption" color="textSecondary">{item.added_by===user?'Added by you':'Added by your partner'}{item.hidden_from&&!item.revealed_at?' · 🔒 Private':''}{item.revealed_at?' · Revealed':''}</Text>
     {!!item.url&&<Button title="Open link" variant="ghost" onPress={()=>{void state.run(async()=>{if(!/^https?:\/\//i.test(item.url!))throw new Error('This link is unavailable.');await Linking.openURL(item.url!);});}}/>}
     {!item.done_at&&<Button title="We did it!" disabled={disabled} onPress={()=>complete(item)}/>}
     {!!item.hidden_from&&!item.revealed_at&&item.added_by===user&&<Button title="Reveal to my partner" disabled={disabled} onPress={()=>reveal(item)}/>}
     {selected.kind==='gifts'&&item.added_by!==user&&!item.done_at&&<Button title={state.rows.some(i=>i.url===claimPrefix+item.id)?'✓ I’m getting this · Unclaim':'I’m getting this (private)'} variant="secondary" disabled={disabled} onPress={()=>claim(item)}/>}
     {selected.kind==='watch'&&<Button title="Watch together" variant="secondary" onPress={()=>router.push({pathname:'/(tabs)/watch',params:{title:item.title}})}/>}
     {!!item.done_at&&<><Text variant="label">Your rating</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs}}>{[1,2,3,4,5].map(n=><PressableScale key={n} accessibilityRole="button" accessibilityLabel={`Rate ${n} stars`} accessibilityState={{selected:(isA?item.rating_a:item.rating_b)===n}} disabled={disabled||!partner.data} style={{minWidth:geometry.touch,minHeight:geometry.touch,justifyContent:'center',alignItems:'center'}} onPress={()=>{void state.run(async()=>{await items.update(item.id,isA?{rating_a:n}:{rating_b:n});});}}><Text>{n<=((isA?item.rating_a:item.rating_b)??0)?'★':'☆'}</Text></PressableScale>)}</View>
      {item.rating_a&&item.rating_b&&<Text>{item.rating_a===item.rating_b?`You both gave it ⭐ ${item.rating_a}`:`Your ratings: ⭐ ${isA?item.rating_a:item.rating_b} + ⭐ ${isA?item.rating_b:item.rating_a}`}</Text>}
      {(!item.hidden_from||item.revealed_at)&&<Button title={item.media_id?'Saved in Memories':'Make it a memory'} variant="secondary" disabled={disabled||!!item.media_id} onPress={()=>memory(item)}/>}</>}
     <View style={{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm}}><Button title="Move up" variant="ghost" disabled={disabled||rows[0]?.id===item.id} onPress={()=>move(item,-1)}/><Button title="Move down" variant="ghost" disabled={disabled||rows[rows.length-1]?.id===item.id} onPress={()=>move(item,1)}/><Button title="Remove" variant="ghost" disabled={disabled} onPress={()=>remove(item)}/></View>
    </Card></ItemGesture>)}</StaggerList>
    {items.data?.length===2000&&<Text color="textSecondary">Showing up to 2,000 ideas. Older items may be outside this view.</Text>}
   </>}
  </ScrollView>
  <BottomSheet visible={composer} title={custom?'A new list':'Save a little idea'} onClose={()=>{if(!state.working)setComposer(false);}}>
   <TextField label={custom?'List name':'Idea or title'} value={title} onChangeText={setTitle} maxLength={custom?160:500} editable={!state.working}/>
   {!custom&&<><TextField label="Link (optional)" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" maxLength={2000} editable={!state.working}/><TextField label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={3900} editable={!state.working}/><Text variant="caption">Mood: {mood}. Choose a mood above before adding to tag your idea.</Text></>}
   {!!state.error&&<Text color="danger" accessibilityRole="alert">{state.error}</Text>}<Button title="Save" loading={state.working} disabled={disabled} onPress={add}/>
  </BottomSheet>
  <BottomSheet visible={!!celebration} title={celebration?.reveal?'The secret is out':'A little victory for us'} onClose={()=>setCelebration(undefined)}>
   {celebration&&<><Ceremony title={celebration.reveal?'Surprise! Now it’s yours to share.':celebration.item.title} trigger={celebration.trigger}/>
    {!celebration.reveal&&(!celebration.item.hidden_from||celebration.item.revealed_at)&&<Button title="Make it a memory" loading={state.working} disabled={disabled} onPress={()=>memory(celebration.item)}/>}
    {!!state.error&&<Text color="danger">{state.error}</Text>}<Button title="Keep dreaming" variant="secondary" onPress={()=>setCelebration(undefined)}/></>}
  </BottomSheet>
  {toast&&<Toast message={toast.message} actionLabel={toast.undo?'Undo':undefined} onAction={toast.undo?()=>{toast.undo?.();pending.current=undefined;setToast(undefined);}:undefined} onDismiss={finishToast}/>}
 </Screen>;
}

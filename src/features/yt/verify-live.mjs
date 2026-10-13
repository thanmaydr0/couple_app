// Uses the existing private verification accounts without printing credentials.
// Creates and removes only a new test row; refuses to interrupt an active party.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const root = new URL('../../../', import.meta.url);
const env = Object.fromEntries(readFileSync(new URL('supabase/deployment/client.env',root),'utf8').trim().split(/\r?\n/).map(line=>line.split(/=(.*)/s).slice(0,2)));
const credentials=JSON.parse(readFileSync(new URL('supabase/.private/account-credentials.json',root),'utf8'));
const make=()=>createClient(env.EXPO_PUBLIC_SUPABASE_URL,env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
const clients=[make(),make()],anonymous=make(); let row;
const check=result=>{if(result.error)throw new Error(`YouTube backend check failed: ${result.error.code??result.error.name}`);return result.data;};
function subscribe(channel,deny=false){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Subscription timed out')),15000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);deny?reject(new Error('Forbidden room was authorized')):resolve();}if(['CHANNEL_ERROR','TIMED_OUT'].includes(status)){clearTimeout(timer);deny?resolve():reject(new Error(`Subscription ${status}`));}});});}
async function until(predicate,label){const end=Date.now()+15000;while(!predicate()){assert(Date.now()<end,`${label} timed out`);await new Promise(resolve=>setTimeout(resolve,50));}}
try{
  const profiles=[];
  for(let i=0;i<2;i++){
    const account=credentials.accounts[i];const {session}=check(await clients[i].auth.signInWithPassword({email:account.email,password:account.password}));
    profiles.push(check(await clients[i].from('profiles').select('id,couple_id').eq('id',session.user.id).single()));await clients[i].realtime.setAuth(session.access_token);
  }
  assert(profiles[0].couple_id&&profiles[0].couple_id===profiles[1].couple_id);
  const existing=check(await clients[0].from('yt_sessions').select('id').eq('status','active'));
  assert.equal(existing.length,0,'An active YouTube party exists; refusing to alter it.');
  const video={videoId:'dQw4w9WgXcQ',title:'Protocol check',thumbnail:'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'};
  row=check(await clients[0].from('yt_sessions').insert({couple_id:profiles[0].couple_id,host_id:profiles[0].id,current_video_id:video.videoId,queue:[video]}).select().single());
  assert.equal(check(await clients[1].from('yt_sessions').select('id').eq('id',row.id).single()).id,row.id);
  const received=[[],[]],presence=[false,false],updates=[];
  const pair=clients.map((client,i)=>client.channel(`yt:${row.id}`,{config:{private:true,broadcast:{ack:true,self:false},presence:{key:`verify-${i}`}}}).on('broadcast',{event:'*'},({event})=>received[i].push(event)));
  pair.forEach((c,i)=>c.on('presence',{event:'sync'},()=>{presence[i]=Object.keys(c.presenceState()).length===2;}));
  pair[1].on('postgres_changes',{event:'UPDATE',schema:'public',table:'yt_sessions',filter:`id=eq.${row.id}`},payload=>updates.push(payload.new.status));
  await subscribe(pair[0]);await subscribe(pair[1]);await pair[0].track({user:profiles[0].id,active:true});await pair[1].track({user:profiles[1].id,active:true});
  await until(()=>presence.every(Boolean),'both participants presence');
  const events=['play','pause','seek','rate','load','heartbeat','buffering','ended','ready','ping','pong','reaction','leave'];
  for(let i=0;i<2;i++)for(const event of events)assert.equal(await pair[i].send({type:'broadcast',event,payload:{sender:profiles[i].id,pos:12,videoId:video.videoId}}),'ok');
  await until(()=>received.every(list=>list.length===events.length),'bidirectional sync');received.forEach(list=>assert.deepEqual(list,events));
  console.log('PASS both accounts read session; presence and all 13 private events deliver without self echoes');
  const first=check(await clients[0].from('yt_sessions').update({queue:[]}).eq('id',row.id).eq('queue',JSON.stringify([video])).select());assert.equal(first.length,1);
  const stale=check(await clients[1].from('yt_sessions').update({queue:[video,video]}).eq('id',row.id).eq('queue',JSON.stringify([video])).select());assert.equal(stale.length,0);
  const forged=await clients[1].from('yt_sessions').update({couple_id:randomUUID()}).eq('id',row.id).select();assert(forged.error||!forged.data.length);
  const anonRead=await anonymous.from('yt_sessions').select('id').eq('id',row.id);assert(anonRead.error||anonRead.data.length===0);
  await subscribe(clients[0].channel(`yt:${randomUUID()}`,{config:{private:true}}),true);
  await subscribe(anonymous.channel(`yt:${row.id}`,{config:{private:true}}),true);
  console.log('PASS stale queue write rejected; cross-couple reassignment and anonymous/unknown rooms denied');
  check(await clients[0].from('yt_sessions').update({status:'ended'}).eq('id',row.id));await until(()=>updates.includes('ended'),'session ending');
  console.log('PASS persisted end reaches partner through Postgres Changes');
}finally{
  if(row)check(await clients[0].from('yt_sessions').delete().eq('id',row.id));
  await Promise.all([...clients,anonymous].map(client=>client.removeAllChannels()));clients.forEach(client=>client.auth.stopAutoRefresh());
}

// Uses the existing ignored integration credentials; never logs credentials or
// tokens. Only disposable audio objects and a future capsule are created.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const root = new URL('../../../', import.meta.url);
const env = Object.fromEntries(readFileSync(new URL('supabase/deployment/client.env',root),'utf8').trim().split(/\r?\n/).map(line=>line.split(/=(.*)/s).slice(0,2)));
const credentials = JSON.parse(readFileSync(new URL('supabase/.private/account-credentials.json',root),'utf8'));
const accounts = Array.isArray(credentials) ? credentials : credentials.accounts;
const clients = [0,1].map(()=>createClient(env.EXPO_PUBLIC_SUPABASE_URL,env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}));
const check = result => { if(result.error) throw new Error(`Backend validation failed: ${result.error.code ?? result.error.name}`); return result.data; };
const id=randomUUID(); let couple; let voicePath; let capsulePath; let created=false;
try {
  for(let i=0;i<2;i++) check(await clients[i].auth.signInWithPassword(accounts[i]));
  const author=check(await clients[0].auth.getUser()).user.id;
  couple=check(await clients[0].from('profiles').select('couple_id').eq('id',author).single()).couple_id;
  voicePath=`${couple}/chat/voice/${id}.m4a`;capsulePath=`${couple}/capsules/${id}/${id}.m4a`;
  // Storage enforces MIME/path authorization, not audio decoding. These bytes
  // are intentionally a disposable fixture, not a claim of native playback.
  const bytes=new Uint8Array([0,0,0,24,102,116,121,112,77,52,65,32,0,0,0,0,105,115,111,109,109,112,52,50]);
  check(await clients[0].storage.from('media').upload(voicePath,bytes,{contentType:'audio/mp4'}));
  check(await clients[0].storage.from('media').upload(voicePath,bytes,{contentType:'audio/mp4',upsert:true}));
  const signed=check(await clients[1].storage.from('media').createSignedUrl(voicePath,60)).signedUrl;
  assert.equal((await fetch(signed)).status,200);
  assert((await clients[1].storage.from('media').createSignedUrl(`${randomUUID()}/chat/voice/${id}.m4a`,60)).error);
  console.log('PASS: AAC MIME accepted, durable retry upserts, partner reads, outside-couple access denied');
  check(await clients[0].from('capsules').insert({id,couple_id:couple,author_id:author,title:'Voice storage verification',body:'',unlock_at:new Date(Date.now()+3600000).toISOString()}));created=true;
  check(await clients[0].storage.from('capsules').upload(capsulePath,bytes,{contentType:'audio/mp4'}));
  check(await clients[0].from('capsules').update({voice_path:capsulePath}).eq('id',id));
  check(await clients[0].storage.from('capsules').createSignedUrl(capsulePath,60));
  assert((await clients[1].storage.from('capsules').createSignedUrl(capsulePath,60)).error);
  console.log('PASS: voice-only capsule saves and sealed audio remains private until unlock');
} finally {
  if(voicePath) check(await clients[0].storage.from('media').remove([voicePath]));
  if(created) { check(await clients[0].storage.from('capsules').remove([capsulePath]));check(await clients[0].from('capsules').delete().eq('id',id)); }
  // These clients use isolated non-persisted sessions. Do not revoke the app's
  // other sessions by calling global signOut during verification.
}

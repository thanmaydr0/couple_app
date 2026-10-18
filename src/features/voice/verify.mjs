import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(relative, mocks = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(relative, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; new Function('exports', 'require', compiled)(exports, id => { if (!(id in mocks)) throw new Error(`Unexpected import ${id}`); return mocks[id]; }); return exports;
}
const types = load('./types.ts');
const body = load('../chat/body.ts', {
  '@/features/e2ee/runtime': { encryptionRequired: async () => false },
  '@/features/e2ee/files': { rememberFile() {} },
  '@/features/e2ee/crypto': { isEnvelope: () => false },
  '@/features/voice/types': types,
});
const model = load('../chat/model.ts', { '../voice/types': types, './body': body });
const meta = { duration_ms: 1000, peaks: Array(64).fill(0.5) };
const row = { id:'v1', client_id:'v1', couple_id:'couple', sender_id:'sender', kind:'voice', body:null, media_path:'couple/chat/voice/v1.m4a', reply_to:null, read_at:null, created_at:'2026-10-13T01:00:00Z', status:'sent', meta };
test('waveforms keep 64 bounded bins including silent and short recordings', () => {
  for (const input of [[],[0.2], Array.from({length:3000},(_,i)=>i%2 ? 0.2 : 0.9)]) {
    const peaks=types.voicePeaks(input); assert.equal(peaks.length,64); assert(peaks.every(p=>p>=0&&p<=1));
  }
  assert.equal(types.voiceTime(300000),'5:00');
});
test('voice metadata is validated before cache/realtime reconciliation', () => {
  assert(model.isMessage(row));
  for (const invalid of [null,{...meta,duration_ms:300001},{...meta,peaks:[0.5]},{...meta,peaks:Array(64).fill(2)}]) assert(!model.isMessage({...row,meta:invalid}));
  assert.equal(body.bodySummary(row),'Voice message');
  assert.equal(body.bodySummary({...row,deleted_at:'2026-10-13T02:00:00Z'}),'This message was deleted');
});
test('heard receipts survive late insert echoes and outbox files survive failure', () => {
  const heard = {...row,meta:{...meta,played_at:'2026-10-13T02:00:00Z'}};
  assert.equal(model.mergeMessages([heard],[row])[0].meta.played_at,heard.meta.played_at);
  const pending={...row,status:'failed',localUri:'file://durable.m4a'};
  assert.equal(model.cacheWindow([pending])[0].localUri,pending.localUri);
  assert.equal(model.mergeMessages([heard],[pending])[0].status,'sent');
});
test('Android recording focus guard stays muted, detects interruption once and releases', () => {
  let emit; let removed=false; let interrupts=0;
  const player={ muted:false,loop:false,play(){assert(this.muted);assert(this.loop);},remove(){removed=true;},addListener:(_,cb)=>{emit=cb;return{remove(){}};} };
  const focus=load('./recordingFocus.ts', {'./silence.wav':1,'expo-audio':{createAudioPlayer:()=>player}});
  const release=focus.recordingFocus(()=>interrupts++);
  emit({playing:false});assert.equal(interrupts,0);
  emit({playing:true});emit({playing:false});emit({playing:false});assert.equal(interrupts,1);
  release();assert(removed);emit({playing:false});assert.equal(interrupts,1);
});
test('one player, rates, sequential voice-only queue, focus loss and stale loads', async () => {
  const players=[]; let appState; let callState; let callPhase='idle'; let rpcCalls=0;
  const app={currentState:'active',addEventListener:(_,cb)=>{appState=cb;return{remove(){}};}};
  let resolveUrl;
  const engine=load('./playback.ts', {
    '@/features/e2ee/files': { decryptedFile: async () => { throw new Error('Encrypted files are covered by the E2EE suite'); } },
    'expo-audio':{setAudioModeAsync:async()=>{},createAudioPlayer:()=>{const p={position:0,rate:1,paused:false,removed:false,play(){this.paused=false;},pause(){this.paused=true;},remove(){this.removed=true;},seekTo:async n=>{p.position=n;},setPlaybackRate:n=>{p.rate=n;},addListener:(_,cb)=>{p.emit=cb;return{remove(){}};}};players.push(p);return p;}},
    'react-native':{AppState:app},
    '@/features/calls/engine':{useCalls:{getState:()=>({phase:callPhase}),subscribe:cb=>{callState=cb;return()=>{};}}},
    '@/lib/supabase':{supabase:{rpc:async()=>{rpcCalls++;return{};},storage:{from:()=>({createSignedUrl:()=>new Promise(resolve=>{resolveUrl=resolve;})})}}},
  });
  const track=id=>({id,uri:`file://${id}`,couple:'couple',receiver:true,meta});
  const release=engine.watchAudioFocus(); const secondRelease=engine.watchAudioFocus();
  await engine.playVoice(track('a')); assert.equal(players.length,1);
  engine.voiceSpeed(); assert.equal(players[0].rate,1.5); engine.voiceSpeed(); assert.equal(players[0].rate,2); engine.voiceSpeed(); assert.equal(players[0].rate,1);
  players[0].emit({playing:true,currentTime:0.1,duration:1,isLoaded:true}); assert.equal(rpcCalls,1);
  await engine.seekVoice('a',0.5); assert.equal(players[0].position,0.5);
  engine.setVoiceQueue([{...track('a'),path:'a'},{...track('b'),path:'b'},{id:'text',path:null},{...track('c'),path:'c'}]);
  players[0].emit({playing:false,currentTime:1,duration:1,isLoaded:true,didJustFinish:true}); await Promise.resolve();await Promise.resolve();
  assert.equal(engine.playbackSnapshot().id,'b'); assert(players[0].removed);
  players[1].emit({playing:false,currentTime:1,duration:1,isLoaded:true,didJustFinish:true}); assert.equal(engine.playbackSnapshot().id,'b');
  release(); assert(!players[1].removed,'unmounting a different bubble must not stop audio');
  callPhase='incoming'; callState({phase:callPhase}); assert(players[1].paused); await engine.playVoice(track('c')); assert.equal(players.length,2);
  callPhase='idle'; engine.claimRecording(true); await engine.playVoice(track('c')); assert.equal(players.length,2);engine.claimRecording(false);
  const pending=engine.playVoice({id:'remote',path:'path'}); await Promise.resolve(); app.currentState='background'; appState('background'); resolveUrl({data:{signedUrl:'https://example.com/audio'}});await pending;assert.equal(players.length,2);
  secondRelease(); assert(players[1].removed);
});

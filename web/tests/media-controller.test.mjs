import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const compile = file => ts.transpileModule(file,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { MediaController } = await import(url(compile(await readFile(new URL('../src/media-controller.ts',import.meta.url),'utf8'))));
function fixture() {
  let status=8; const calls=[]; let release; let inFlight=0; let maximum=0;
  const raw={currentTime:0n,getStatus:()=>status,
    async play(){calls.push('play');status=6;},async pause(){calls.push('pause');status=8;},
    async seek(value){inFlight++;maximum=Math.max(maximum,inFlight);calls.push(['seek',Number(value)]);await new Promise(resolve=>{release=resolve;});raw.currentTime=value;inFlight--;},
    async selectAudio(id){inFlight++;maximum=Math.max(maximum,inFlight);calls.push(['audio',id]);inFlight--;},
    async selectSubtitle(id){calls.push(['caption',id]);},setSubtitleEnable(value){calls.push(['captions',value]);},setPlaybackRate(){},setVolume(){},
  };
  const controller=new MediaController(raw);controller.duration=300;
  return {raw,controller,calls,release:()=>release(),maximum:()=>maximum};
}
const transportCalls = calls => calls.filter(call=>!Array.isArray(call)||call[0]!=='captions');
test('rapid seeks coalesce and never run concurrently with track changes',async()=>{
  const f=fixture();await f.controller.enable();f.calls.length=0;
  f.controller.currentTime=10;f.controller.currentTime=40;f.controller.currentTime=90;
  const audio=f.controller.selectAudio(2);
  assert.equal(f.controller.currentTime,90);assert.equal(f.controller.busy,true);
  f.release();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(transportCalls(f.calls),[['seek',10000],['seek',90000]]);
  f.release();await audio;await f.controller.settled();
  assert.deepEqual(transportCalls(f.calls),[['seek',10000],['seek',90000],['audio',2]]);assert.equal(f.maximum(),1);assert.equal(f.controller.currentTime,90);
});
test('pause during a seek wins over the earlier play intent without oscillation',async()=>{
  const f=fixture();await f.controller.enable();f.controller.play();await f.controller.settled();f.calls.length=0;
  f.controller.currentTime=100;f.controller.pause();f.release();await f.controller.settled();
  assert.equal(f.controller.playing,false);assert.deepEqual(transportCalls(f.calls),[['seek',100000],'pause']);
});
test('duplicate heartbeat play calls do not restart the decoder',async()=>{
  const f=fixture();await f.controller.enable();f.calls.length=0;
  for(let i=0;i<30;i++)f.controller.play();await f.controller.settled();assert.deepEqual(transportCalls(f.calls),['play']);
});
test('caption switches flush old cues at the same local time without transport changes',async()=>{
  const f=fixture();await f.controller.enable();f.calls.length=0;
  f.raw.currentTime=42000n;f.raw.seek=async value=>{f.calls.push(['seek',Number(value)]);f.raw.currentTime=value;};
  await f.controller.selectAudio(3);await f.controller.selectSubtitle(4);await f.controller.selectSubtitle(-1);
  assert.deepEqual(f.calls,[['audio',3],['caption',4],['captions',true],['seek',42000],['captions',false]]);assert.equal(f.controller.currentTime,42);
});

test('Off to the already-selected subtitle explicitly enables rendering before refreshing cues',async()=>{
  const f=fixture();await f.controller.enable();f.calls.length=0;
  let rendering=false;let visible=false;
  f.raw.getSelectedSubtitleStreamId=()=>4;
  f.raw.setSubtitleEnable=value=>{rendering=value;visible=false;f.calls.push(['captions',value]);};
  f.raw.seek=async()=>{visible=rendering;};
  await f.controller.selectSubtitle(-1);
  await f.controller.selectSubtitle(4);
  assert.equal(visible,true);assert.deepEqual(f.calls,[['captions',false],['captions',true]]);
  // Going Off again must clear the screen; enabling must remain reliable.
  await f.controller.selectSubtitle(-1);assert.equal(visible,false);
  await f.controller.selectSubtitle(4);assert.equal(visible,true);
});
test('slow demux seeks do not trigger a shared frozen-player pause',async()=>{
  const modelUrl=url(compile(await readFile(new URL('../../src/features/movie/model.ts',import.meta.url),'utf8')));
  const smoothingUrl=url(compile(await readFile(new URL('../src/playback-smoothing.ts',import.meta.url),'utf8')));
  const source=compile(await readFile(new URL('../src/watch-sync.ts',import.meta.url),'utf8')).replace("'../../src/features/movie/model'",JSON.stringify(modelUrl)).replace("'./playback-smoothing.js'",JSON.stringify(smoothingUrl));
  const {WatchSync}=await import(url(source));let now=100000;let pauses=0;const sent=[];
  const player={currentTime:0,duration:300,playbackRate:1,playing:false,busy:false,play(){this.playing=true;},pause(){this.playing=false;pauses++;}};
  const sync=new WatchSync({user:'host',partner:'guest',host:'host',client:'browser',player,now:()=>now,send:(event,payload)=>sent.push({event,payload}),change(){},reaction(){}});
  sync.connect(true);sync.setReady(true);
  sync.receive('ready',{sender:'guest',client:'android',seq:1,sentAt:now,pos:0,playing:false,ready:true,stamp:{counter:0,actor:''},resume:false});
  sync.control('play');sync.control('seek',120);player.busy=true;const before=pauses;
  for(let i=0;i<24;i++){now+=250;sync.tick();}
  assert.equal(pauses,before);assert.equal(player.playing,true);
});

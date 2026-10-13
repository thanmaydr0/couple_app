// Run with node src/features/yt/verify.mjs. Uses existing TypeScript; no install.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = name => ts.transpileModule(readFileSync(new URL(name, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const typesUrl = url(compile('./types.ts'));
const linksUrl = url(compile('./links.ts'));
const { parseYouTube, fetchVideo } = await import(linksUrl);
const { YouTubeSync } = await import(url(compile('./sync.ts').replaceAll("'./links'", JSON.stringify(linksUrl)).replaceAll("'./types'", JSON.stringify(typesUrl))));
const { playerHtml, playerError } = await import(url(compile('./playerHtml.ts').replaceAll("'./types'", JSON.stringify(typesUrl))));
const id = 'dQw4w9WgXcQ';
for (const link of [`https://www.youtube.com/watch?v=${id}&t=40`, `https://youtu.be/${id}?si=abc`, `https://m.youtube.com/shorts/${id}`, `Shared with you: https://youtube.com/watch?v=${id}`, `youtube.com/watch?v=${id}`, `https://www.youtube.com/playlist?list=PL1234567890&v=${id}`]) assert.equal(parseYouTube(link).videoId, id);
assert.equal(parseYouTube('https://youtube.com/playlist?list=PL1234567890').playlistId, 'PL1234567890');
for (const link of ['https://youtube.com.evil.test/watch?v='+id, 'https://evil.test/watch?v='+id, 'https://youtube.com/watch?v=<script>', 'https://youtube.com/watch?v=short', 'https://youtu.be/', 'https://youtube.com/playlist?list=<script>']) assert.throws(() => parseYouTube(link));
console.log('PASS safe video/shared-text/playlist parsing');

function simulation(skew = 0, autoStart = false) {
  let now = 100000, queue = [], drop = false;
  const players = [0, 0].map(pos => ({ pos, duration: 300, state: 5, rates: [0.5, 0.75, 1, 1.25, 1.5, 2], rate: 1, buffering: false, commands: [] }));
  const sent = []; const reacted = [[], []]; const ended = [0, 0];
  const engines = players.map((p, i) => new YouTubeSync({ user: i ? 'guest' : 'host', partner: i ? 'host' : 'guest', host: 'host', client: i ? 'B' : 'A', videoId: id, autoStart,
    now: () => now + (i ? skew : 0), change() {}, reaction: r => reacted[i].push(r), ended: () => ended[i]++,
    send: (event, packet) => { sent.push({ i, at: now, event, packet }); if (!drop) queue.push({ to: 1-i, event, packet, at: now + 50 }); },
    command: c => { p.commands.push(c); if (c.action === 'play') p.state = p.buffering ? 3 : 1; if (c.action === 'pause') p.state = p.buffering ? 3 : 2; if (c.action === 'seek') p.pos = c.value; if (c.action === 'rate') p.rate = c.value; },
  }));
  function advance(ms) {
    for (let t = 0; t < ms; t += 50) {
      now += 50; players.forEach(p => { if (p.state === 1) p.pos += 0.05 * p.rate; });
      const due = queue.filter(q => q.at <= now); queue = queue.filter(q => q.at > now); for (const q of due) engines[q.to].receive(q.event, q.packet);
      if (now % 500 === 0) { engines.forEach((e,i) => e.sample({ ...players[i] })); engines.forEach(e => e.tick()); }
    }
  }
  return { engines, players, sent, reacted, ended, advance, setDrop: v => drop = v };
}
{
  const s = simulation(); const [a,b] = s.engines;
  a.connect(true); a.loaded(); a.control('play'); assert.equal(s.players[0].state, 2);
  assert.equal(s.sent.length, 0, 'no broadcast while alone');
  b.connect(true); b.loaded(); a.presence(true); b.presence(true); s.advance(1000);
  a.control('play'); s.advance(2000); assert(a.view.playing && b.view.playing);
  b.control('pause'); s.advance(1000); assert.equal(s.players[0].state, 2); assert.equal(s.players[1].state, 2);
  b.control('seek', 40); s.advance(1000); assert(Math.abs(s.players[0].pos-40)<0.1);
  a.control('rate',1.5); s.advance(1000); assert.equal(s.players[1].rate,1.5);
  a.reaction('😂'); s.advance(100); assert.deepEqual(s.reacted,[['😂'],['😂']]);
  const before = s.sent.length; for(let i=0;i<100;i++)a.control('pause'); assert(s.sent.length-before<=15);
  a.foregroundState(false); const bg = s.sent.length; s.advance(4000); assert.equal(s.sent.filter(p=>p.i===0&&p.at>s.sent[bg-1]?.at).length,0);
  console.log('PASS readiness gate, either-person controls, rate, seek, reactions, 15Hz ceiling and background silence');
}
{
  const s = simulation(4500); const [a,b] = s.engines;
  for(const e of [a,b]) { e.connect(true); e.loaded(); e.presence(true); } s.advance(1000);
  a.control('play'); s.advance(5000); assert(a.view.playing && b.view.playing); assert(b.view.latency<=100);
  s.players[1].pos -= 4; s.advance(5000); assert(Math.abs(s.players[0].pos-s.players[1].pos)<0.3);
  assert(s.players[1].commands.some(c=>c.action==='seek'), 'large drift seeks');
  const seeks = s.players[1].commands.filter(c=>c.action==='seek').length;
  s.players[1].pos -= 0.5; s.advance(5000);
  assert(s.players[1].commands.some(c=>c.action==='rate'&&c.value>1),'small drift uses supported rate pulse');
  assert.equal(s.players[1].commands.filter(c=>c.action==='seek').length,seeks,'small drift does not seek');
  s.players[1].buffering=true; s.players[1].state=3; s.advance(1500); assert.equal(s.players[0].state,2); assert(!a.view.playing);
  s.players[1].buffering=false; s.players[1].state=2; s.advance(4500); assert(a.view.playing&&b.view.playing,'both-playing recovery');
  s.setDrop(true); b.control('pause'); s.advance(17000); assert.equal(s.players[0].state,2); assert(!a.view.partnerHere);
  console.log('PASS clock skew, latency estimation, >1s seek, supported rate nudges, buffering recovery and peer timeout');
}
{
  const s=simulation(0,true); for(const e of s.engines){e.connect(false);e.connect(true);e.loaded();e.presence(true);} s.advance(5000);
  assert(s.engines.every(e=>e.view.playing),'next video auto-starts after both ready');
  const old=s.sent.find(p=>p.event==='play'); const before=s.players[1].commands.length;
  s.engines[1].receive(old.event,old.packet); assert.equal(s.players[1].commands.length,before,'duplicate packet ignored');
  s.engines[1].receive('pause',{...old.packet,videoId:'aaaaaaaaaaa',seq:100}); assert.equal(s.players[1].commands.length,before,'different video ignored');
  console.log('PASS gated next-video autoplay, duplicate and wrong-video isolation');
}
{
  const messages=[], listeners={}; let native;
  const fake={getCurrentTime:()=>3,getDuration:()=>30,getPlayerState:()=>5,getAvailablePlaybackRates:()=>[1],cueVideoById:v=>assert.equal(v,id),playVideo:()=>native='play',pauseVideo:()=>native='pause',seekTo:v=>native=v,setPlaybackRate:v=>native=v,setSize(){}};
  const context={ window:{innerHeight:240,ReactNativeWebView:{postMessage:v=>messages.push(JSON.parse(v))},addEventListener:(event,fn)=>listeners[event]=fn},document:{addEventListener:(event,fn)=>listeners[event]=fn,createElement:()=>({}),head:{appendChild(){}}},setInterval:fn=>fn(),Number,JSON,YT:{Player:function(_element,opts){queueMicrotask(()=>opts.events.onReady());return fake;}} };
  vm.createContext(context); vm.runInContext(playerHtml(id).match(/<script>([\s\S]*?)<\/script>/)[1],context); context.onYouTubeIframeAPIReady(); await new Promise(resolve=>setImmediate(resolve));
  listeners.message({data:JSON.stringify({action:'play'})}); assert.equal(native,'play');
  listeners.message({data:JSON.stringify({action:'seek',value:12})}); assert.equal(native,12);
  assert(messages.some(m=>m.type==='ready')&&messages.some(m=>m.type==='sample'));
  assert.match(playerError(101),/disabled embedding/); assert.match(playerError(153),/verify/);
  console.log('PASS IFrame postMessage bridge and error translations');
}
if(process.argv.includes('--live-oembed')) {
  const video=await fetchVideo(id); assert.equal(video.videoId,id); assert(video.title.length>0); console.log('PASS live public oEmbed preview');
}

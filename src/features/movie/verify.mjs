// Deterministic transport/decoder simulation. No native build or new dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = name => ts.transpileModule(readFileSync(new URL(name, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const modelUrl = url(compile('./model.ts'));
const { matches, driftCorrection } = await import(modelUrl);
const { WatchSync } = await import(url(compile('./sync.ts').replace("'./model'", JSON.stringify(modelUrl))));
const file = { uri: 'file:///movie.mp4', name: 'Movie', size: 1234, durationMs: 100000 };
assert(matches(file, { file_size: 1234, duration_ms: 101000 }));
assert(!matches(file, { file_size: 1234, duration_ms: 101001 }));
assert(!matches(file, { file_size: 1235, duration_ms: 100000 }));
assert(!matches(file, { file_size: null, duration_ms: null }));
assert.deepEqual(driftCorrection(0.2), { seek: false, rate: 1 });
assert.deepEqual(driftCorrection(-0.4), { seek: false, rate: 0.97 });
assert.deepEqual(driftCorrection(0.4), { seek: false, rate: 1.03 });
assert.equal(driftCorrection(0.601).seek, true);
console.log('PASS metadata mismatch boundaries and drift thresholds');

function simulation(skew = 0, bufferOnSeek = false) {
  let now = 100000; let nextTick = now + 250; const queue = [];
  const players = [42, 5].map(currentTime => ({ currentTime, playbackRate: 1, playing: false, frozen: false, duration: 7200,
    play() { this.playing = true; }, pause() { this.playing = false; } }));
  const receivedReactions = [[], []]; let drop = false;
  const engines = players.map((player, index) => new WatchSync({ user: index ? 'guest' : 'host', partner: index ? 'host' : 'guest', host: 'host', client: index ? 'B' : 'A', player,
    now: () => now + (index ? skew : 0), change() {}, reaction: emoji => receivedReactions[index].push(emoji),
    send: (event, payload) => { if (!drop) queue.push({ at: now + 50, to: 1 - index, event, payload: structuredClone(payload) }); },
  }));
  const nativeEvents = [];
  if (bufferOnSeek) players.forEach((player, index) => {
    let position = player.currentTime;
    let generation = 0;
    player.seeks = 0;
    Object.defineProperty(player, 'currentTime', { get: () => position, set: value => {
      if (bufferOnSeek !== 'delayed') position = value;
      player.seeks++;
      const id = ++generation;
      nativeEvents.push({ at: now, run: () => engines[index].setReady(false) });
      nativeEvents.push({ at: now + 150, run: () => {
        if (id === generation) { if (bufferOnSeek === 'delayed') position = value; engines[index].setReady(true); }
      } });
    } });
    player.advance = seconds => { position += seconds * player.playbackRate; };
  });
  function advance(ms) {
    const end = now + ms;
    while (now < end) {
      queue.sort((a, b) => a.at - b.at);
      nativeEvents.sort((a, b) => a.at - b.at);
      const target = Math.min(end, nextTick, queue[0]?.at ?? Infinity, nativeEvents[0]?.at ?? Infinity);
      for (const player of players) if (player.playing && !player.frozen) {
        if (player.advance) player.advance((target - now) / 1000);
        else player.currentTime += (target - now) / 1000 * player.playbackRate;
      }
      now = target;
      while (nativeEvents.length && nativeEvents[0].at <= now) nativeEvents.shift().run();
      while (queue.length && queue[0].at <= now) {
        const item = queue.shift(); engines[item.to].receive(item.event, item.payload);
      }
      if (now === nextTick) { engines.forEach(e => e.tick()); nextTick += 250; }
    }
  }
  return { engines, players, advance, receivedReactions, setDrop: value => { drop = value; } };
}
const s = simulation(90000);
s.engines[0].setReady(true); s.engines[0].connect(true);
s.engines[0].control('play'); assert.equal(s.players[0].playing, false, 'first play must wait for partner');
s.engines[1].setReady(true); s.engines[1].connect(true); s.advance(500);
assert(s.engines.every(e => e.state.bothReady));
assert.equal(s.players[1].currentTime, 42, 'host initial resume point wins');
assert.equal(s.engines[0].state.latency, 50, 'RTT estimator works with skewed clocks');
s.engines[1].control('play'); s.advance(1000);
assert(s.players.every(p => p.playing));
assert(Math.abs(s.players[0].currentTime - s.players[1].currentTime) < 0.15);
s.engines[0].control('pause'); s.advance(100);
assert(s.players.every(p => !p.playing));
assert(Math.abs(s.players[0].currentTime - s.players[1].currentTime) < 0.01);
s.engines[0].control('seek', 100); s.engines[1].control('seek', 200); s.advance(500);
assert(s.players.every(p => Math.abs(p.currentTime - 200) < 0.01), 'simultaneous controls converge');
s.engines[0].control('play'); s.advance(500);
s.players[1].currentTime -= 0.4; s.advance(4000);
assert.equal(s.players[1].playbackRate, 1.03, 'small drift nudges follower');
s.players[1].currentTime -= 2; s.advance(4000);
assert(Math.abs(s.players[0].currentTime - s.players[1].currentTime) < 0.2, 'large drift seeks');
s.engines[1].setReady(false); s.advance(250);
assert(s.players.every(p => !p.playing), 'stall pauses both');
s.engines[1].setReady(true); s.advance(500);
assert(s.players.every(p => p.playing), 'recovery resumes together');
s.engines[0].reaction('😂'); s.advance(100);
assert.deepEqual(s.receivedReactions, [['😂'], ['😂']]);
s.engines[1].setForeground(false); s.advance(200);
assert(s.players.every(p => !p.playing));
assert.equal(s.engines[0].state.partnerHere, false);
s.engines[1].setForeground(true); s.advance(4500);
assert(s.engines.every(e => e.state.bothReady));
assert(s.players.every(p => !p.playing), 'return requires explicit play');
s.engines[0].control('play'); s.advance(200);
s.setDrop(true); s.advance(12500);
assert(s.players.every(p => !p.playing), 'lost heartbeat pauses both');
assert(s.engines.every(e => !e.state.partnerHere));
s.setDrop(false); s.advance(4500);
assert(s.engines.every(e => e.state.bothReady));
s.engines[0].end(); s.advance(100);
assert(s.engines.every(e => e.state.ended));
s.engines[1].control('play'); assert(s.players.every(p => !p.playing));
console.log('PASS first-play gate, skewed clocks, either controller, collisions, drift, stall/recover, reactions, background/return, disconnect/rejoin, end');

const bad = simulation();
bad.engines[0].setReady(true); bad.engines[0].connect(true);
bad.engines[0].receive('play', null);
bad.engines[0].receive('play', { sender: 'stranger', pos: 30 });
assert.equal(bad.players[0].playing, false);
console.log('PASS invalid/foreign payload rejection');

const frozen = simulation();
frozen.engines.forEach(e => { e.setReady(true); e.connect(true); }); frozen.advance(500);
frozen.engines[0].control('play'); frozen.advance(500);
frozen.players[1].frozen = true; frozen.advance(5000);
assert(frozen.players.every(p => !p.playing), 'drift seeks must not mask a frozen follower');
assert(frozen.engines.every(e => e.state.bothReady), 'watchdog must preserve actual native readiness');
frozen.players[1].frozen = false; frozen.engines[1].control('play'); frozen.advance(500);
assert(frozen.players.every(p => p.playing));
console.log('PASS frozen follower pauses both and allows manual recovery without a status transition');

const native = simulation(0, true);
native.engines.forEach(e => { e.setReady(true); e.connect(true); }); native.advance(1000);
native.engines[0].control('play'); native.advance(15000);
assert(native.players.every(p => p.playing), 'seek-induced buffering must settle into playback');
assert(native.players.every(p => p.currentTime > 50), 'both decoders must advance after recovery');
assert(native.players.every(p => p.seeks < 8), 'resume must not continuously seek and rebuffer');
native.engines[1].control('seek', 100); native.advance(5000);
assert(native.players.every(p => p.playing && p.currentTime >= 103), 'a playing seek must recover without another seek loop');
console.log('PASS native seek/loading/ready callbacks converge without a buffering loop');

function connectedSimulation(bufferOnSeek = false) {
  const result = simulation(0, bufferOnSeek);
  result.engines.forEach(e => { e.setReady(true); e.connect(true); }); result.advance(1000);
  return result;
}
for (const controller of [0, 1]) {
  const pausedSeek = connectedSimulation(true);
  pausedSeek.engines[controller].control('seek', 120); pausedSeek.advance(5000);
  assert(pausedSeek.players.every(p => !p.playing && p.currentTime === 120), 'paused seeks must stay paused after loading');
  pausedSeek.engines[controller].control('play'); pausedSeek.advance(1000);
  pausedSeek.engines.forEach(e => e.setReady(false)); pausedSeek.advance(500);
  pausedSeek.engines.forEach(e => e.setReady(true)); pausedSeek.advance(5000);
  assert(pausedSeek.players.every(p => p.playing), 'simultaneous buffering must recover regardless of controller');

  const manual = connectedSimulation();
  manual.engines[controller].control('play'); manual.advance(1000);
  manual.engines[1 - controller].setReady(false); manual.advance(200);
  manual.engines[controller].control('pause'); manual.advance(200);
  manual.engines[1 - controller].setReady(true); manual.advance(5000);
  assert(manual.players.every(p => !p.playing), 'explicit pause during buffering cancels auto-resume');
}
console.log('PASS either controller: paused seeks, simultaneous buffering, manual cancellation');

const ordered = connectedSimulation();
ordered.engines[0].control('play'); ordered.advance(5000);
ordered.players[1].playing = false;
ordered.engines[1].unexpectedPause(); // playingChange arrives before statusChange
ordered.engines[1].setReady(false); ordered.advance(500);
ordered.engines[1].setReady(true); ordered.advance(1000);
assert(ordered.players.every(p => p.playing), 'playing=false before loading must preserve resume intent');
ordered.advance(5000);
ordered.players[1].playing = false; ordered.engines[1].unexpectedPause(); ordered.advance(500);
assert(ordered.players.every(p => !p.playing), 'audio-focus pause with no loading must pause both');
console.log('PASS Android callback ordering and audio-focus interruption');

const timeout = connectedSimulation();
timeout.engines[0].control('play'); timeout.advance(1000);
timeout.engines[1].setReady(false); timeout.advance(21000);
assert(timeout.engines[1].state.notice.includes('timed out'), 'persistent buffering must offer actionable recovery');
timeout.engines[1].setReady(true); timeout.advance(1000);
assert(timeout.players.every(p => !p.playing), 'timeout must cancel automatic resume');
timeout.engines[0].control('play'); timeout.advance(1000);
assert(timeout.players.every(p => p.playing), 'play after timeout recovery must work');
console.log('PASS buffering timeout and recovery');

for (const controller of [0, 1]) {
  const delayed = connectedSimulation('delayed');
  delayed.engines[controller].control('seek', 120); delayed.advance(5000);
  assert(delayed.players.every(p => !p.playing && p.currentTime === 120), 'paused async seeks must broadcast the requested position');
  delayed.engines[controller].control('play'); delayed.advance(1000);
  delayed.engines[controller].control('seek', 240); delayed.advance(5000);
  assert(delayed.players.every(p => p.playing && p.currentTime >= 243), 'async playing seeks must resume at the requested position');
}
console.log('PASS native seeks whose position getter remains stale until readiness');

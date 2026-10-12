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

function simulation(skew = 0) {
  let now = 100000; let nextTick = now + 250; const queue = [];
  const players = [42, 5].map(currentTime => ({ currentTime, playbackRate: 1, playing: false, frozen: false, duration: 7200,
    play() { this.playing = true; }, pause() { this.playing = false; } }));
  const receivedReactions = [[], []]; let drop = false;
  const engines = players.map((player, index) => new WatchSync({ user: index ? 'guest' : 'host', partner: index ? 'host' : 'guest', host: 'host', client: index ? 'B' : 'A', player,
    now: () => now + (index ? skew : 0), change() {}, reaction: emoji => receivedReactions[index].push(emoji),
    send: (event, payload) => { if (!drop) queue.push({ at: now + 50, to: 1 - index, event, payload: structuredClone(payload) }); },
  }));
  function advance(ms) {
    const end = now + ms;
    while (now < end) {
      queue.sort((a, b) => a.at - b.at);
      const target = Math.min(end, nextTick, queue[0]?.at ?? Infinity);
      for (const player of players) if (player.playing && !player.frozen) player.currentTime += (target - now) / 1000 * player.playbackRate;
      now = target;
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
frozen.players[1].frozen = false; frozen.engines[1].setReady(true); frozen.advance(500);
assert(frozen.players.every(p => p.playing));
console.log('PASS frozen follower pauses both and recovers after readiness');

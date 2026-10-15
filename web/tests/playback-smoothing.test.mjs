import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const smoothingUrl = moduleUrl(compile(await read('../src/playback-smoothing.ts')));
const { PlaybackSmoother } = await import(smoothingUrl);
const modelUrl = moduleUrl(compile(await read('../../src/features/movie/model.ts')));
const syncSource = compile(await read('../src/watch-sync.ts')).replace("'../../src/features/movie/model'", JSON.stringify(modelUrl)).replace("'./playback-smoothing.js'", JSON.stringify(smoothingUrl));
const { WatchSync } = await import(moduleUrl(syncSource));

test('brief latency spikes never seek; small drift uses only a gentle rate', () => {
  const smoother = new PlaybackSmoother(); smoother.reset(0);
  for (let now = 0; now < 600000; now += 250) {
    const drift = now % 12000 < 1500 ? 5 : 0.8;
    const correction = smoother.correction(drift, now);
    assert.equal(correction.seek, false);
    assert.ok([1, 1.01].includes(correction.rate));
  }
});

test('persistent large drift seeks once and has a 15 second cooldown', () => {
  const smoother = new PlaybackSmoother(); smoother.reset(0);
  const seeks = [];
  for (let now = 0; now < 30000; now += 250) {
    if (smoother.correction(6, now).seek) { seeks.push(now); smoother.reset(now); }
  }
  assert.deepEqual(seeks, [13000]);
});

test('hysteresis avoids repeated speed changes near the tolerance boundary', () => {
  const smoother = new PlaybackSmoother(); smoother.reset(0);
  assert.equal(smoother.correction(0.8, 5000).rate, 1.01);
  assert.equal(smoother.correction(0.7, 6000).rate, 1.01);
  assert.equal(smoother.correction(0.8, 7000).rate, 1.01);
  assert.equal(smoother.correction(0.2, 8000).rate, 1);
  assert.equal(smoother.correction(-0.8, 9000).rate, 0.99);
});

function follower() {
  let now = 100000; let position = 0; let pauses = 0; const seeks = []; let seq = 0;
  const player = { duration: 900, playbackRate: 1, playing: false, busy: false,
    get currentTime() { return position; }, set currentTime(value) { position = value; seeks.push(value); },
    play() { this.playing = true; }, pause() { this.playing = false; pauses++; } };
  const sync = new WatchSync({ user: 'guest', partner: 'host', host: 'host', client: 'follower', player, now: () => now, send() {}, change() {}, reaction() {} });
  const receive = (event, pos, playing = true, counter = 1) => sync.receive(event, { sender: 'host', client: 'leader', seq: ++seq, sentAt: now, pos, playing, ready: true, stamp: { counter, actor: 'leader' }, resume: false });
  sync.connect(true); sync.setReady(true); receive('play', 0);
  return { player, sync, seeks, receive, pauses: () => pauses, advance(ms, moving = true) { now += ms; if (moving && player.playing) position += ms / 1000 * player.playbackRate; } };
}

test('ten minutes of web heartbeats tolerate jitter without repeated seeks or pauses', () => {
  const f = follower(); const pauses = f.pauses();
  for (let i = 1; i <= 2400; i++) {
    f.advance(250);
    if (i % 16 === 0) f.receive('heartbeat', f.player.currentTime + (i % 32 === 0 ? 1.2 : -0.8));
    f.sync.tick();
  }
  assert.deepEqual(f.seeks, []); assert.equal(f.pauses(), pauses); assert.equal(f.player.playing, true);
  // Explicit controls still apply immediately, independently of drift cooldown.
  f.receive('seek', 700, true, 2); assert.equal(f.player.currentTime, 700);
  f.receive('pause', 700, false, 3); assert.equal(f.player.playing, false);
});

test('decoder work ignores stale heartbeats; a short stall does not pause the pair', () => {
  const f = follower(); const pauses = f.pauses(); f.player.busy = true;
  for (let i = 0; i < 32; i++) { f.advance(250, false); if (i % 8 === 0) f.receive('heartbeat', 20); f.sync.tick(); }
  assert.deepEqual(f.seeks, []); assert.equal(f.pauses(), pauses);
  f.player.busy = false;
  for (let i = 0; i < 24; i++) { f.advance(250, false); if (i % 8 === 0) f.receive('heartbeat', f.player.currentTime); f.sync.tick(); }
  assert.equal(f.pauses(), pauses);
  f.advance(250); f.sync.tick(); assert.equal(f.player.playing, true);
});

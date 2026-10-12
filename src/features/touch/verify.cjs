// Deterministic two-client simulation of the actual hook; no credentials or installs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
function load(name, mocks) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, name), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; new Function('require', 'module', 'exports', source)(id => mocks[id], module, module.exports); return module.exports;
}
const protocol = load('protocol.ts', {});
assert.equal(protocol.decode({ kind: 'touch' }), null);
assert.equal(protocol.decode({ user: 'b', instance: 'b1', seq: 1, at: 1, kind: 'touch', down: true, point: { x: NaN, y: 0 } }), null);
assert.equal(protocol.decode({ user: 'b', instance: 'b1', seq: 1, at: 1, kind: 'touch', down: true, point: { x: 2, y: 0 } }), null);
assert.equal(protocol.together({ x: .5, y: .5, down: true }, { x: .51, y: .5, down: true }), true);
assert.equal(protocol.together({ x: .5, y: .5, down: false }, { x: .5, y: .5, down: true }), false);
assert.equal(protocol.duration(192000), '3:12');
assert.equal(protocol.predict({ x: .5, y: .5, down: true, at: 1 }, { x: .6, y: .5, down: true, at: 101 }, 10000).x, .7);

const saved = { now: Date.now, setTimeout, clearTimeout, setInterval, clearInterval };
let now = 1000000, id = 0, current;
const timers = new Map(), channels = [], sent = [], storage = new Map(), vibrations = [], appListeners = [];
Date.now = () => now;
global.setTimeout = (fn, ms) => { const key = ++id; timers.set(key, { fn, at: now + ms }); return key; };
global.setInterval = (fn, ms) => { const key = ++id; timers.set(key, { fn, at: now + ms, ms }); return key; };
global.clearInterval = global.clearTimeout = key => timers.delete(key);
const AppState = { currentState: 'active', addEventListener: (_, fn) => { appListeners.push(fn); return { remove() {} }; } };
const sync = () => channels.forEach(c => c.handlers.presence?.());
const supabase = {
  channel(topic, options) {
    assert.equal(topic, 'touch:couple'); assert.equal(options.config.private, true);
    const c = { options, handlers: {}, tracked: null, on(type, _, fn) { this.handlers[type] = fn; return this; },
      subscribe(fn) { this.subscription = fn; fn('SUBSCRIBED'); return this; },
      track(p) { this.tracked = p; sync(); return Promise.resolve('ok'); },
      untrack() { this.tracked = null; sync(); return Promise.resolve('ok'); },
      presenceState() { return Object.fromEntries(channels.filter(c => c.tracked).map((c, i) => [i, [c.tracked]])); },
      send(m) { sent.push(m.payload); channels.filter(other => other !== c).forEach(other => other.handlers.broadcast?.({ payload: m.payload })); return Promise.resolve('ok'); },
    }; channels.push(c); return c;
  }, removeChannel: async () => {}, functions: { invoke: async () => ({ data: { ok: true }, error: null }) },
};
const mocks = {
  react: { useRef: value => ({ current: value }), useEffect: fn => current.effects.push(fn), useState: value => { const fixture = current, key = fixture.values.push(value) - 1; return [value, v => { fixture.values[key] = typeof v === 'function' ? v(fixture.values[key]) : v; }]; } },
  'react-native': { AppState }, '@react-native-community/netinfo': { __esModule: true, default: { addEventListener: () => () => {} } },
  'expo-haptics': { ImpactFeedbackStyle: { Light: 'light', Heavy: 'heavy' }, impactAsync: async style => { vibrations.push({ at: now, style }); } },
  '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async k => storage.get(k) ?? null, setItem: async (k, v) => storage.set(k, v) } },
  '@/lib/supabase': { supabase }, '@/motion': { motionTokens: { fast: 160, hero: 600 } }, './protocol': protocol,
};
const { useTouchRoom, invitePartner } = load('useTouchRoom.ts', mocks);
function mount(user, partner, intensity = 'gentle', full = true) { current = { effects: [], values: [] }; const fixture = current; fixture.room = useTouchRoom('couple', user, partner, '#112233', true, intensity, full); fixture.cleanup = fixture.effects.map(fn => fn()).filter(Boolean); return fixture; }
async function advance(ms) {
  const end = now + ms;
  while (true) { const due = [...timers].sort((a, b) => a[1].at - b[1].at)[0]; if (!due || due[1].at > end) break; now = due[1].at; if (due[1].ms) due[1].at += due[1].ms; else timers.delete(due[0]); due[1].fn(); await Promise.resolve(); }
  now = end; await Promise.resolve();
}
(async () => {
  const a = mount('a', 'b'); a.room.move({ x: .5, y: .5 }); assert.equal(sent.length, 0, 'No movement without partner');
  const b = mount('b', 'a'); b.room.move({ x: .5, y: .5 });
  await advance(3000); assert(vibrations.length >= 4, 'Both peers receive synchronized double pulses');
  assert.equal(vibrations[0].at, vibrations[1].at, 'Pulse starts agree');
  const before = sent.filter(m => m.kind === 'touch' && m.user === 'a').length;
  for (let i = 0; i < 1000; i++) { a.room.move({ x: .5 + i / 100000, y: .5 }); await advance(1); }
  const after = sent.filter(m => m.kind === 'touch' && m.user === 'a').length;
  assert(after - before <= 15, 'At most 15 coordinate messages per second');
  await advance(100); const stationary = sent.filter(m => m.kind === 'touch').length;
  await advance(2000); assert.equal(sent.filter(m => m.kind === 'touch').length, stationary, 'Stationary hold sends no coordinates');
  a.room.up(); await advance(100); assert.equal(b.room.theirs.current.down, false, 'Release reaches peer');
  assert(a.values[6] > 0, 'Held duration accumulates');
  const beforeInvalid = b.room.theirs.current.seq;
  channels[1].handlers.broadcast({ payload: { user: 'intruder', instance: 'x', seq: 99999, at: now, kind: 'touch', down: true, point: { x: .1, y: .1 } } });
  assert.equal(b.room.theirs.current.seq, beforeInvalid, 'Unrecognized sender ignored');
  a.room.tap({ x: .2, y: .3 }); await advance(100); a.room.tap({ x: .2, y: .3 });
  assert(sent.some(m => m.kind === 'heart' && m.point.x === .2 && m.point.y === .3), 'Double tap preserves normalized location');
  AppState.currentState = 'background'; appListeners.forEach(fn => fn('background'));
  const background = sent.length; a.room.move({ x: .8, y: .8 }); await advance(2000); assert.equal(sent.length, background, 'Background sends nothing');
  AppState.currentState = 'active';
  now += protocol.LIMITS.capMs; await advance(100); assert.equal(a.values[5], true, '30 minute cap pauses stream');
  a.cleanup.forEach(fn => fn()); b.cleanup.forEach(fn => fn());
  const offA = mount('a', 'b', 'off'), offB = mount('b', 'a', 'off');
  offA.room.move({ x: .5, y: .5 }); offB.room.move({ x: .5, y: .5 });
  const offCount = vibrations.length; await advance(3500); assert.equal(vibrations.length, offCount, 'Off intensity disables haptics');
  // Simulate a silent transport: presence remains but no packets arrive.
  const originals = channels.map(c => c.send); channels.forEach(c => { c.send = () => Promise.resolve('ok'); });
  await advance(7000); assert.equal(offA.room.mine.current.down, false, 'Stale peer clears local touch'); assert.equal(offA.room.theirs.current.down, false, 'Stale peer clears remote touch');
  channels.forEach((c, i) => { c.send = originals[i]; });
  offA.cleanup.forEach(fn => fn()); offB.cleanup.forEach(fn => fn());
  const reducedA = mount('a', 'b', 'strong', false), reducedB = mount('b', 'a', 'strong', false);
  reducedA.room.move({ x: .5, y: .5 }); reducedB.room.move({ x: .5, y: .5 });
  const reducedCount = vibrations.length; await advance(3500); assert.equal(vibrations.length, reducedCount, 'Reduced motion disables decorative haptics');
  const touchCount = sent.filter(m => m.kind === 'touch').length;
  channels[channels.length - 1].untrack(); reducedA.room.move({ x: .2, y: .2 }); await advance(500);
  assert.equal(sent.filter(m => m.kind === 'touch').length, touchCount, 'Partner leave stops coordinate broadcasts');
  reducedA.cleanup.forEach(fn => fn()); reducedB.cleanup.forEach(fn => fn());
  await invitePartner('a'); assert.match(await invitePartner('a'), /recently/, 'Invite cooldown survives remount');
  assert.equal(timers.size, 0, 'Cleanup clears all timers');
  console.log('PASS: two peers, private channel, synchronized haptics, throttling, stationary hold, release, sender validation, heart, background, cap, invitation cooldown, off/reduced haptics, stale transport, partner leave, cleanup');
})().finally(() => { Date.now = saved.now; Object.assign(global, { setTimeout: saved.setTimeout, clearTimeout: saved.clearTimeout, setInterval: saved.setInterval, clearInterval: saved.clearInterval }); }).catch(error => { console.error(error); process.exitCode = 1; });

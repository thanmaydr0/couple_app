const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const base = __dirname;
function load(name, mocks = {}) {
  const source = fs.readFileSync(`${base}/${name}${name === 'DrawingCanvas' ? '.tsx' : '.ts'}`, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(output, { module: mod, exports: mod.exports, require: id => mocks[id] ?? require(id), console, setInterval: (...args) => global.setInterval(...args), clearInterval: (...args) => global.clearInterval(...args), Date, Math }, { filename: name });
  return mod.exports;
}
const words = load('words'); const model = load('model');
assert.equal(new Set(words.WORDS).size, 300);
for (let i = 0; i < 100; i++) { const choices = words.choices(); assert.equal(new Set(choices).size, 3); assert.ok(choices.every(word => words.WORDS.includes(word))); }
assert.equal(words.normalize('  ApPLe  '), 'apple');
assert.ok(words.closeGuess('apples', 'apple')); assert.ok(words.closeGuess('cherries', 'cherry')); assert.ok(!words.closeGuess('dog', 'cat'));
assert.equal(words.pattern('apple'), '_ _ _ _ _'); assert.equal(words.pattern('apple', [1, 4]), '_ P _ _ E');
assert.equal(words.pointsFor(80).guesser, 900); assert.equal(words.pointsFor(80).drawer, 500); assert.equal(words.pointsFor(0).guesser, 100);
assert.ok(!model.packetSchema.safeParse({ sender: 'b', round: 0, id: 'x', strokes: [{ id: 's', color: '#ffffff', size: 4, points: [{ x: 1001, y: 0 }] }] }).success);

// Exercise the actual mutable canvas model, independently of native Skia drawing.
const NativeDrawing = load('DrawingCanvas', { react: {}, 'react-native': { StyleSheet: { create: value => value } }, '@shopify/react-native-skia': {}, 'react-native-reanimated': {}, 'react-native-gesture-handler': {} }).Drawing;
const actualDrawing = new NativeDrawing();
const firstStroke = { id: 'one', color: '#ffffff', size: 5, points: [{ x: 1, y: 2 }] };
actualDrawing.append(firstStroke); firstStroke.points.push({ x: 3, y: 4 });
assert.equal(actualDrawing.strokes[0].points.length, 1, 'local stroke model must not alias live point array');
actualDrawing.append({ ...firstStroke, points: [{ x: 3, y: 4 }] }, false, 1);
actualDrawing.append({ ...firstStroke, points: [{ x: 3, y: 4 }] }, false, 1);
assert.equal(actualDrawing.strokes[0].points.length, 2, 'snapshot overlap must not duplicate a batch');
actualDrawing.append(firstStroke, true); assert.equal(actualDrawing.count(), 2);
actualDrawing.undo(); assert.equal(actualDrawing.count(), 0);

// Run the real hook for two simulated clients, with in-memory broadcast, storage,
// and optimistic database versions. No native runtime or real users are needed.
let rendering; let time = 100000; Date.now = () => time;
let nextTimer = 1; const timers = new Map();
global.setInterval = (fn, delay) => { const id = nextTimer++; timers.set(id, { fn, delay, last: time }); return id; };
global.clearInterval = id => timers.delete(id);
const db = []; const clients = []; const trace = []; let drop = '';
const clone = value => JSON.parse(JSON.stringify(value));
const react = {
  useRef(initial) { const client = rendering; const index = client.index++; return client.hooks[index] ??= { current: initial }; },
  useState(initial) { const client = rendering; const index = client.index++; client.hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [client.hooks[index].value, value => { client.hooks[index].value = typeof value === 'function' ? value(client.hooks[index].value) : value; client.dirty = true; }]; },
  useEffect(callback, deps) { const client = rendering; const index = client.index++; const previous = client.hooks[index]; if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) { client.pending.push(() => { previous?.cleanup?.(); client.hooks[index] = { deps, cleanup: callback() }; }); } },
};
class Drawing {
  strokes = [];
  replace(strokes) { this.strokes = clone(strokes); }
  count() { return this.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0); }
  append(stroke, full = false, offset) { const old = this.strokes.find(item => item.id === stroke.id); if (!old) this.strokes.push(clone(stroke)); else if (full) Object.assign(old, clone(stroke)); else old.points.push(...clone(stroke.points.slice(offset === undefined ? 0 : Math.max(0, old.points.length - offset)))); }
  undo() { this.strokes.pop(); }
}
function createClient(uid, peer) {
  const client = { uid, peer, hooks: [], pending: [], dirty: true, index: 0, value: null, online: true, appListeners: [], storage: new Map() }; clients.push(client);
  const AppState = { currentState: 'active', addEventListener: (_, listener) => { client.appListeners.push(listener); return { remove: () => { client.appListeners = client.appListeners.filter(item => item !== listener); } }; } }; client.AppState = AppState;
  const channels = [];
  const supabase = {
    channel(topic) {
      const channel = { topic, client, subscribed: false, handlers: new Map(), on(_, filter, callback) { this.handlers.set(filter.event, callback); return this; }, subscribe(callback) { this.subscribed = true; this.status = callback; queueMicrotask(() => callback('SUBSCRIBED')); return this; }, async send(packet) { trace.push(clone(packet)); for (const other of clients.flatMap(item => item.channels ?? [])) if (other !== channel && other.subscribed && other.topic === topic && packet.event !== drop) queueMicrotask(() => other.handlers.get(packet.event)?.({ payload: clone(packet.payload) })); return 'ok'; } }; channels.push(channel); return channel;
    },
    removeChannel(channel) { channel.subscribed = false; return Promise.resolve(); },
    from() {
      let action = 'select', payload, filters = [];
      const query = { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, order() { return this; }, limit() { return this; }, insert(value) { action = 'insert'; payload = value; return this; }, update(value) { action = 'update'; payload = value; return this; }, single() { return execute(true); }, maybeSingle() { return execute(true); }, then(resolve, reject) { return execute(false).then(resolve, reject); } };
      async function execute(single) {
        if (action === 'insert') { const row = { ...clone(payload), id: crypto.randomUUID(), rounds_played: 0, created_at: String(time), updated_at: crypto.randomUUID() }; db.unshift(row); return { data: clone(row), error: null }; }
        const selected = db.filter(row => filters.every(([key, value]) => row[key] === value));
        if (action === 'update') selected.forEach(row => Object.assign(row, clone(payload), { updated_at: crypto.randomUUID() }));
        return { data: single ? clone(selected[0] ?? null) : clone(selected), error: null };
      }
      return query;
    },
  };
  client.channels = channels;
  const presence = Object.assign(selector => selector({ partnerOnline: client.online }), { getState: () => ({ partnerOnline: client.online }) });
  const hook = load('useScribble', { react, 'react-native': { AppState }, '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async key => client.storage.get(key) ?? null, setItem: async (key, value) => { client.storage.set(key, value); } } }, 'expo-crypto': { randomUUID: crypto.randomUUID, CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_, word) => crypto.createHash('sha256').update(word).digest('hex') }, 'expo-haptics': { selectionAsync: async () => {}, notificationAsync: async () => {}, NotificationFeedbackType: { Success: 1, Warning: 2 } }, '@/lib/hooks': { useProfile: () => ({ data: { id: uid, couple_id: 'couple' } }), usePartner: () => ({ data: { id: peer } }) }, '@/lib/supabase': { supabase }, '@/features/presence/PresenceProvider': { usePresence: presence }, './DrawingCanvas': { Drawing }, './model': model, './words': words }).useScribble;
  client.render = () => { rendering = client; client.index = 0; client.value = hook(); client.dirty = false; client.pending.splice(0).forEach(fn => fn()); };
  client.render(); return client;
}
async function settle() { for (let i = 0; i < 20; i++) { await new Promise(resolve => setImmediate(resolve)); clients.filter(client => client.dirty).forEach(client => client.render()); } }
async function tick(seconds = 1) { for (let i = 0; i < seconds; i++) { time += 1000; for (const timer of [...timers.values()]) if (time - timer.last >= timer.delay) { timer.last = time; timer.fn(); } await settle(); } }
(async () => {
  const a = createClient('a', 'b'), b = createClient('b', 'a'); await settle();
  await a.value.start(2); await settle(); await b.value.join(db[0]); await settle(); await tick(2);
  assert.equal(a.value.paused, false); assert.equal(b.value.paused, false);
  const word = a.value.options[0]; await a.value.pick(word); await settle();
  assert.equal(b.value.game.phase, 'draw'); assert.ok(!JSON.stringify(b.value.game).includes(`"${word}"`));
  a.value.begin({ x: 10, y: 20 }, '#20202a', 10); a.value.point({ x: 40, y: 60 }); await tick(); a.value.endStroke(); await settle();
  assert.equal(b.value.drawing.strokes[0].points.length, 2);
  a.value.tool('undo'); await settle(); assert.equal(b.value.drawing.strokes.length, 0);
  a.value.begin({ x: 10, y: 20 }, '#ffffff', 18); a.value.endStroke(); await settle(); a.value.tool('clear'); await settle(); assert.equal(b.value.drawing.strokes.length, 0);
  await tick(29); assert.equal(b.value.game.hints, 1); await tick(20); assert.equal(b.value.game.hints, 2);
  b.AppState.currentState = 'background'; b.appListeners.forEach(listener => listener('background')); await settle(); const remaining = a.value.game.remaining; await tick(5); assert.equal(a.value.game.remaining, remaining);
  b.AppState.currentState = 'active'; b.appListeners.forEach(listener => listener('active')); await settle(); await tick(2);
  assert.ok(b.value.guess(`${word}s`)); await settle(); assert.equal(b.value.feed.at(-1).feedback, 'close');
  await tick(); assert.ok(b.value.guess(`  ${word.toUpperCase()}  `)); await settle();
  assert.equal(a.value.game.phase, 'summary'); assert.equal(b.value.game.phase, 'summary'); assert.equal(db[0].rounds_played, 1); assert.ok(a.value.game.scores.a > 0); assert.ok(a.value.game.scores.b > a.value.game.scores.a);
  // Lose the next-round broadcast: the periodic full snapshot must recover it.
  drop = 'round_start'; await a.value.nextRound(); await settle(); drop = ''; await tick(6);
  assert.equal(b.value.game.phase, 'pick'); assert.equal(b.value.game.round, 1); assert.equal(model.drawerOf(b.value.game), 'b');
  await b.value.pick(b.value.options[0]); await settle(); assert.equal(a.value.game.phase, 'draw');
  b.value.begin({ x: 50, y: 40 }, '#e34b60', 5); b.value.point({ x: 70, y: 80 }); b.value.endStroke(); await settle();
  // Leave and reopen: full history, phase and remaining time recover from drawer.
  a.value.leave(); await settle(); await a.value.join(db[0]); await settle(); await tick(2);
  assert.equal(a.value.drawing.strokes[0].points.length, 2); assert.equal(a.value.game.phase, 'draw');
  // The authoritative drawer can leave and restore its private answer/history.
  const drawerWord = b.value.secret;
  b.value.leave(); await settle(); await b.value.join(db[0]); await settle(); await tick(2);
  assert.equal(b.value.secret, drawerWord); assert.equal(b.value.drawing.strokes[0].points.length, 2);
  // Presence disconnection pauses without writing to the shared presence store.
  a.online = false; b.online = false; a.dirty = true; b.dirty = true; await settle();
  const disconnectedRemaining = b.value.game.remaining; await tick(5); assert.equal(b.value.game.remaining, disconnectedRemaining);
  a.online = true; b.online = true; a.dirty = true; b.dirty = true; await settle(); await tick(2);
  await tick(81); assert.equal(a.value.game.phase, 'final'); assert.equal(b.value.game.phase, 'final'); assert.equal(db[0].rounds_played, 2);
  assert.equal(db[0].scores.a, a.value.game.scores.a); assert.equal(db[0].scores.b, b.value.game.scores.b);
  assert.ok(trace.some(packet => packet.event === 'sync_request')); assert.ok(trace.some(packet => packet.event === 'sync_state'));
  const starts = trace.filter(packet => packet.event === 'round_start' && packet.payload.game.phase === 'draw'); assert.ok(starts.every(packet => packet.payload.game.revealed === '' && packet.payload.game.hash.length === 64));
  // Play again with the default six rounds, checking each authority transfer.
  await a.value.start(6); await settle(); await b.value.join(db[0]); await settle(); await tick(2);
  for (let round = 0; round < 6; round++) {
    const drawer = round % 2 === 0 ? a : b; const guesser = drawer === a ? b : a;
    const answer = drawer.value.options[0]; await drawer.value.pick(answer); await settle(); await tick();
    assert.equal(guesser.value.game.phase, 'draw'); assert.ok(guesser.value.guess(answer)); await settle();
    assert.equal(db[0].rounds_played, round + 1);
    if (round < 5) { await drawer.value.nextRound(); await settle(); }
  }
  assert.equal(a.value.game.phase, 'final'); assert.equal(b.value.game.phase, 'final');
  assert.ok(a.value.game.scores.a > 0 && a.value.game.scores.b > 0);
  console.log('PASS: 300 words; choices; normalization; close guesses; scoring; payload bounds; two-player flow; incremental strokes; eraser; undo/clear; hints; background pause; lost transition recovery; reconnect history; alternating drawer; timeout; final persisted scores.');
})().catch(error => { console.error(error); process.exitCode = 1; });

// Run the real hook with fake native events, storage, transport and clocks.
// No React Native runtime, native build, credentials or extra dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = name => ts.transpileModule(readFileSync(new URL(name, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const model = url(compile('./model.ts'));
const sync = url(compile('./sync.ts').replace("'./model'", JSON.stringify(model)));
const mocks = url(`
  export const useEffect = fn => globalThis.movieHookTest.effects.push(fn);
  export const useLayoutEffect = fn => globalThis.movieHookTest.layouts.push(fn);
  export const useRef = value => ({ current: value });
  export const useState = value => {
    const test = globalThis.movieHookTest;
    const index = test.values.push(value) - 1;
    return [value, next => { test.values[index] = typeof next === 'function' ? next(test.values[index]) : next; }];
  };
  export const useKeepAwake = () => {};
  export const randomUUID = () => 'test-client';
  export const useVideoPlayer = (_, setup) => { const player = globalThis.movieHookTest.player; setup(player); return player; };
  export const AppState = { addEventListener: () => ({ remove() {} }) };
  export const loadPosition = () => globalThis.movieHookTest.loadPosition();
  export const savePosition = (...args) => { globalThis.movieHookTest.saves.push(args); return Promise.resolve(); };
  export const supabase = {
    realtime: { setAuth: async () => {} },
    channel: () => globalThis.movieHookTest.channel,
    removeChannel: async () => {},
    from: () => {
      const query = {
        select: () => query, eq: () => query,
        single: async () => {
          const test = globalThis.movieHookTest; test.queries++;
          return { data: { status: test.sessionStatus }, error: null };
        },
      };
      return query;
    },
  };
`);
const { useWatch } = await import(url(compile('./useWatch.ts').replace(/from (['"])([^'"]+)\1/g,
  (_, quote, path) => `from ${JSON.stringify(path === './sync' ? sync : mocks)}`)));
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

async function harness({ nativeReady = true, deferPosition = false } = {}) {
  const original = { now: Date.now, setInterval, clearInterval, setTimeout, clearTimeout };
  let now = 100000; let timerId = 0; let resolvePosition;
  const timers = new Map(); const listeners = new Map();
  const fixture = {
    effects: [], layouts: [], values: [], saves: [], queries: 0, sessionStatus: 'active',
    loadPosition: () => deferPosition ? new Promise(resolve => { resolvePosition = resolve; }) : Promise.resolve(42),
    player: {
      currentTime: 0, duration: 1000, playbackRate: 1, playing: false, status: 'loading',
      play() { this.playing = true; }, pause() { this.playing = false; },
      addListener(event, callback) {
        const list = listeners.get(event) ?? new Set(); listeners.set(event, list); list.add(callback);
        return { remove: () => list.delete(callback) };
      },
      async replaceAsync() {
        emit('sourceLoad', { duration: 1000 });
        if (nativeReady) { this.status = 'readyToPlay'; emit('statusChange', { status: this.status }); }
      },
    },
    channel: {
      on() { return this; }, subscribe(fn) { fn('SUBSCRIBED'); return this; },
      send: async () => 'ok',
    },
  };
  function emit(event, payload) { for (const fn of listeners.get(event) ?? []) fn(payload); }
  globalThis.movieHookTest = fixture;
  Date.now = () => now;
  globalThis.setInterval = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: now + ms, ms }); return id; };
  globalThis.setTimeout = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: now + ms }); return id; };
  globalThis.clearInterval = globalThis.clearTimeout = id => timers.delete(id);
  useWatch({ id: 'session', couple_id: 'couple', host_id: 'host' }, { uri: 'file:///test.mp4' }, 'host', 'guest');
  const cleanups = [...fixture.layouts, ...fixture.effects].map(fn => fn()).filter(Boolean);
  await flush();
  return {
    fixture, emit,
    async advance(ms) {
      const end = now + ms;
      while (now < end) {
        const due = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!due || due[1].at > end) { now = end; break; }
        now = due[1].at;
        if (due[1].ms) due[1].at += due[1].ms; else timers.delete(due[0]);
        due[1].fn(); await flush();
      }
    },
    async finishLoad() { resolvePosition(42); await flush(); },
    close() {
      cleanups.forEach(fn => fn());
      Date.now = original.now;
      for (const name of ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout']) globalThis[name] = original[name];
      delete globalThis.movieHookTest;
    },
  };
}

const pending = await harness({ deferPosition: true });
try {
  await pending.advance(5000);
  assert.equal(pending.fixture.saves.length, 0, 'preparation must not overwrite the saved position with zero');
  await pending.finishLoad(); await pending.advance(4000);
  assert(pending.fixture.saves.every(args => args[2] === 42));
} finally { pending.close(); }
console.log('PASS hook preserves saved position while preparation is pending');

const loading = await harness({ nativeReady: false });
try {
  await loading.advance(21000);
  assert.match(loading.fixture.values[3], /buffering timed out/i, 'metadata without decoder readiness must time out');
  assert.equal(loading.fixture.player.playing, false);
} finally { loading.close(); }
console.log('PASS hook bounds metadata-loaded but never-ready decoder wait');

const ended = await harness();
try {
  assert.equal(ended.fixture.queries, 1, 'initial session status is checked');
  ended.fixture.sessionStatus = 'ended'; // Deliberately omit broadcast and Postgres callbacks.
  await ended.advance(10000);
  assert.equal(ended.fixture.values[0].ended, true, 'persisted end must be detected without a realtime notification');
  const queries = ended.fixture.queries;
  await ended.advance(10000);
  assert.equal(ended.fixture.queries, queries, 'an ended session stops polling');
} finally { ended.close(); }
console.log('PASS hook detects persisted session end without realtime delivery');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let now = 100_000, rpc = 0, push = 0, deleted = false;
class Clock extends Date { static now() { return now; } }
const storage = new Map();
const supabase = {
  auth: { getUser: async () => ({ data: { user: { id: 'alice' } }, error: null }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { couple_id: 'pair' }, error: null }) }) }) }),
  rpc: async name => { assert.equal(name, 'widget_heartbeat'); rpc++; return { data: true, error: null }; },
  functions: { invoke: async (name, { body }) => { assert.equal(name, 'notify-partner'); assert.equal(body.channel, 'pulse'); assert.equal(body.data.route, '/us/pulse'); push++; return { error: null }; } },
};
const dependencies = {
  '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async key => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value) } },
  '@/lib/supabase': { supabase }, '@/theme/tokens': { themes: { Midnight: {} } },
  'expo-file-system/legacy': { documentDirectory: 'file:///data/', deleteAsync: async path => { assert.equal(path, 'file:///data/widgets/'); deleted = true; } },
  'react-native-compressor': {}, 'base64-arraybuffer': {}, 'expo-crypto': {},
};
const code = ts.transpileModule(fs.readFileSync(`${__dirname}/service.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const api = {};
vm.runInNewContext(code, { exports: api, require: id => { assert(id in dependencies, id); return dependencies[id]; }, Date: Clock });
async function main() {
  const photos = [{ id: 'new' }, { id: 'middle' }, { id: 'old' }];
  const state = { ...api.initialState, couple: 'pair' };
  const day = new Date(2026, 9, 13);
  assert.equal(api.choosePhoto(photos, { ...state, mode: 'latest' }, day).id, 'new');
  assert.equal(api.choosePhoto(photos, state, day).id, api.choosePhoto(photos, state, day).id);
  assert.equal(api.choosePhoto(photos, { ...state, mode: 'favorites', favorites: ['old'] }, day).id, 'old');
  assert.equal(api.choosePhoto(photos, { ...state, mode: 'favorites' }, day), undefined);
  assert.equal(api.choosePhoto([], state, day), undefined);
  await api.writeState({ ...state, enabled: true, owner: 'alice' });
  assert.equal((await api.readState()).owner, 'alice');
  const batch = await Promise.all([api.sendWidgetHeartbeat(), api.sendWidgetHeartbeat()]);
  assert.equal(rpc, 1); assert.equal(push, 1); assert(batch.includes('Wait a moment'));
  assert.equal(await api.sendWidgetHeartbeat(), 'Wait a moment'); assert.equal(rpc, 1);
  now += 10_000; assert.equal(await api.sendWidgetHeartbeat(), 'Sent ♥'); assert.equal(rpc, 2);
  // Simulate a cold JS restart: durable storage still enforces cooldown.
  const restarted = {}; vm.runInNewContext(code, { exports: restarted, require: id => dependencies[id], Date: Clock });
  assert.equal(await restarted.sendWidgetHeartbeat(), 'Wait a moment'); assert.equal(rpc, 2);
  await api.clearWidgets(); assert(deleted); assert.equal((await api.readState()).enabled, false); assert.equal((await api.readState()).owner, '');
  const off = await api.refreshData(); assert.equal(off.enabled, false);
  console.log('PASS: deterministic daily/latest/favorites/empty photo selection; concurrent and durable headless heartbeat cooldown; off-state fetch gating; private cache cleanup.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

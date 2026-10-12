const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness({ active = true, currentUid = 'user' } = {}) {
  const effects = []; const subscriptions = []; const requests = []; let queryOptions; let mutationOptions; const removed = [];
  const client = {
    cancelQueries: async () => {}, invalidateQueries: async () => {}, isMutating: () => 1,
    getQueryData: () => [], setQueryData: () => {},
  };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: currentUid } } } }) },
    channel(name) { const channel = { name, on(event, filter, callback) { subscriptions.push({ event, filter, callback }); return channel; }, subscribe() { return channel; } }; return channel; },
    removeChannel: async channel => { removed.push(channel); },
    from(table) { const request = { table, filters: [] }; requests.push(request); const q = {
      select() { return q; }, eq(key, value) { request.filters.push([key, value]); return q; },
      order() { return q; }, limit() { return q; }, abortSignal() { return q; },
      insert(values) { request.insert = values; return q; }, update(values) { request.update = values; return q; },
      single: async () => ({ data: { id: 'row', couple_id: 'couple' } }),
      then(resolve, reject) { return Promise.resolve({ data: [] }).then(resolve, reject); },
    }; return q; },
  };
  const mocks = {
    react: { useEffect: effect => effects.push(effect), useId: () => 'subscription', useState: value => [value, () => {}] },
    'react-native': { AppState: { currentState: active ? 'active' : 'background', addEventListener: () => ({ remove() {} }) } },
    '@tanstack/react-query': { useQuery: options => { queryOptions = options; return {}; }, useMutation: options => { mutationOptions = options; return {}; }, useQueryClient: () => client },
    '@react-native-community/netinfo': { useNetInfo: () => ({ isConnected: true }) },
    '../hooks': { useProfile: () => ({ data: { id: 'user', couple_id: 'couple' } }), useSession: () => ({ data: { user: { id: 'user' } } }) },
    './feature-client': { featureSupabase: supabase },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(`${__dirname}/useRealtimeTable.ts`, 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, require: key => mocks[key], setTimeout, clearTimeout });
  module.exports.useRealtimeTable({ table: 'feature_rows', decode: row => row });
  return { effects, subscriptions, requests, removed, query: queryOptions, mutation: mutationOptions };
}
test('list reads and writes are scoped; update cannot reassign identity', async () => {
  const h = harness(); await h.query.queryFn({ signal: undefined });
  assert.deepEqual(h.requests[0].filters, [['couple_id', 'couple']]);
  await h.mutation.mutationFn({ kind: 'update', id: 'row', changes: { id: 'forged', couple_id: 'other', title: 'Changed' } });
  assert.deepEqual(h.requests[1].filters, [['id', 'row'], ['couple_id', 'couple']]);
  assert.equal(h.requests[1].update.id, undefined); assert.equal(h.requests[1].update.couple_id, undefined);
  await h.mutation.mutationFn({ kind: 'insert', row: { id: 'new', couple_id: 'other' } });
  assert.equal(h.requests[2].insert.couple_id, 'couple');
});
test('background disables queries/subscriptions; foreground cleanup removes channel', () => {
  const background = harness({ active: false }); assert.equal(background.query.enabled, false);
  background.effects.forEach(effect => effect()); assert.equal(background.subscriptions.length, 0);
  const foreground = harness(); const cleanup = foreground.effects[1]();
  assert.equal(foreground.subscriptions[0].filter.filter, 'couple_id=eq.couple');
  cleanup(); assert.equal(foreground.removed.length, 1);
});
test('account change prevents a stale mutation', async () => {
  const h = harness({ currentUid: 'new-user' });
  await assert.rejects(h.mutation.mutationFn({ kind: 'insert', row: { id: 'new', couple_id: 'couple' } }), /account changed/);
  assert.equal(h.requests.length, 0);
});

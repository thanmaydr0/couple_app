const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
function harness(options = {}) {
  const pushes = [], filters = [];
  const call = { id: 'call-id', kind: 'audio', started_at: new Date().toISOString(), status: 'ringing', ...options.call };
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'caller' } } }) }, from(table) {
    let partner = false;
    const query = { select() { return query; }, eq(key, value) { filters.push([table, key, value]); return query; },
      neq() { partner = true; return query; }, limit() { return query; },
      async maybeSingle() { return { data: table === 'profiles' ? { couple_id: 'couple', display_name: 'Verified caller' } : table === 'calls' ? options.missing ? null : call : { token: 'ExpoPushToken[example]' } }; },
      then(resolve) { return Promise.resolve({ data: partner ? [{ id: 'partner' }] : [] }).then(resolve); } };
    return query;
  } };
  const code = ts.transpileModule(readFileSync(`${__dirname}/index.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: () => ({ createClient: () => client }),
    Deno: { env: { get: () => 'server-only' }, serve() {} }, Response, TextEncoder, AbortSignal, Date,
    fetch: async (_url, request) => { pushes.push(JSON.parse(request.body)); return Response.json({ data: { status: 'ok' } }); } });
  return { pushes, filters, request: body => module.exports.handleRequest(new Request('https://example.com', { method: 'POST', headers: { Authorization: 'Bearer user-token' }, body: JSON.stringify(body) })) };
}
test('calls are high-priority data-only and all invite fields are server-derived', async () => {
  const h = harness();
  const response = await h.request({ channel: 'calls', dataOnly: true, priority: 'normal', data: { callId: 'call-id', callerName: 'spoof', kind: 'video', expiresAt: '2099-01-01', route: '/call' } });
  assert.equal(response.status, 200);
  const [push] = h.pushes;
  assert.equal(push.priority, 'high'); assert.equal(push.title, undefined); assert.equal(push.body, undefined); assert.equal(push.sound, undefined);
  assert.equal(push._contentAvailable, true); assert.equal(push.data.callerName, 'Verified caller'); assert.equal(push.data.kind, 'audio');
  assert.equal(push.data.recipientId, 'partner'); assert.equal(push.data.type, 'call'); assert(push.ttl > 0 && push.ttl <= 40);
  assert(h.filters.some(([table, key, value]) => table === 'calls' && key === 'caller_id' && value === 'caller'));
  assert(h.filters.some(([table, key, value]) => table === 'calls' && key === 'couple_id' && value === 'couple'));
});
test('stale, terminal, and missing calls never push', async () => {
  for (const options of [{ call: { started_at: new Date(Date.now() - 45_000).toISOString() } }, { call: { status: 'declined' } }, { missing: true }]) {
    const h = harness(options); assert.equal((await h.request({ channel: 'calls', dataOnly: true, data: { callId: 'call-id' } })).status, 409); assert.equal(h.pushes.length, 0);
  }
});
test('ordinary message push keeps display title and body', async () => {
  const h = harness(); assert.equal((await h.request({ type: 'message', title: 'Hello', body: 'Message', data: {} })).status, 200);
  assert.equal(h.pushes[0].title, 'Hello'); assert.equal(h.pushes[0].body, 'Message'); assert.equal(h.pushes[0].sound, 'default');
});

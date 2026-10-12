const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness({ valid = true, token = true, rejected = false } = {}) {
  const queries = []; const pushes = [];
  const admin = { from(table) {
    const filters = {};
    const query = {
      select() { return query; }, eq(key, value) { filters[key] = value; return query; },
      neq(key, value) { filters[`not:${key}`] = value; return query; }, limit() { return query; },
      async maybeSingle() {
        queries.push({ table, filters });
        if (table === 'profiles') return { data: { couple_id: 'couple' } };
        return { data: token ? { token: 'ExpoPushToken[private-token]' } : null };
      },
      then(resolve, reject) { queries.push({ table, filters }); return Promise.resolve({ data: [{ id: 'partner' }] }).then(resolve, reject); },
    };
    return query;
  } };
  const source = fs.readFileSync(`${__dirname}/../../../supabase/functions/notify-partner/index.ts`, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, Response, Request, TextEncoder, AbortSignal,
    Deno: { env: { get: () => 'server-only' }, serve() {} },
    require: () => ({ createClient: (_url, _key, options) => {
      assert.equal(options.auth.persistSession, false);
      return { ...admin, auth: { getUser: async () => ({ data: { user: valid ? { id: 'caller' } : null } }) } };
    } }),
    fetch: async (_url, options) => {
      pushes.push(JSON.parse(options.body));
      return Response.json({ data: rejected ? { status: 'error', details: { token: 'never expose' } } : { status: 'ok' } });
    },
  });
  return { queries, pushes, run: (type = 'call', data = {}, auth = true) => module.exports.handleRequest(new Request('https://function.test', {
    method: 'POST', headers: auth ? { Authorization: 'Bearer caller-access-token' } : {},
    body: JSON.stringify({ type, title: 'Notification', body: 'Hello', data }),
  })) };
}

test('authentication gates privileged queries and pushes', async () => {
  const h = harness({ valid: false });
  assert.equal((await h.run('call', {}, false)).status, 401);
  assert.equal((await h.run()).status, 401);
  assert.equal(h.queries.length, 0); assert.equal(h.pushes.length, 0);
});
test('server fixes message/call routing, scopes partner and expires calls at 40 seconds', async () => {
  for (const type of ['call', 'message']) {
    const h = harness();
    assert.equal((await h.run(type, { type: 'test', recipientId: 'outsider', coupleId: 'other' })).status, 200);
    const push = h.pushes[0];
    assert.equal(push.data.type, type); assert.equal(push.data.recipientId, 'partner');
    assert.equal(push.data.coupleId, 'couple'); assert.equal(push.channelId, type === 'call' ? 'calls' : 'messages');
    assert.equal(push.ttl, type === 'call' ? 40 : 86400);
    assert.equal(h.queries.find((q) => q.table === 'push_tokens').filters.user_id, 'partner');
    assert.equal(h.queries.find((q) => q.filters['not:id']).filters.couple_id, 'couple');
  }
});
test('remote tests always target authenticated owner and reject missing registration', async () => {
  const h = harness();
  assert.equal((await h.run('test', { recipientId: 'partner' })).status, 200);
  assert.equal(h.pushes[0].data.recipientId, 'caller');
  assert.equal(h.queries.find((q) => q.table === 'push_tokens').filters.user_id, 'caller');
  assert.equal((await harness({ token: false }).run('test')).status, 409);
});
test('normal token availability stays private and Expo errors never expose tokens', async () => {
  const missing = await harness({ token: false }).run();
  const sent = await harness().run();
  assert.equal(await missing.text(), await sent.text());
  const rejected = await harness({ rejected: true }).run();
  assert.equal(rejected.status, 502); assert.doesNotMatch(await rejected.text(), /never expose|private-token/);
});

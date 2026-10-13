const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
function harness() {
  const displayed = [], filters = [], writes = [], canceled = [];
  let task;
  const invite = { callId: '12345678-1234-1234-1234-123456789abc', kind: 'audio', callerName: 'Partner', recipientId: 'me', coupleId: 'couple', expiresAt: new Date(Date.now() + 39_000).toISOString() };
  const notify = { createChannel: async () => {}, displayNotification: async notification => displayed.push(notification), cancelNotification: async id => canceled.push(id), onForegroundEvent() {} };
  const query = { select() { return query; }, update(value) { writes.push(value); return query; }, eq(key, value) { filters.push([key, value]); return query; }, neq(key, value) { filters.push([`not-${key}`, value]); return query; },
    maybeSingle: async () => ({ data: { caller_id: 'partner', started_at: new Date().toISOString() } }), then: resolve => Promise.resolve({ error: null }).then(resolve) };
  const enums = { AndroidCategory: { CALL: 'call' }, AndroidImportance: { HIGH: 4 }, AndroidVisibility: { PUBLIC: 1 }, AndroidForegroundServiceType: {}, EventType: { ACTION_PRESS: 2, PRESS: 1 } };
  const mocks = {
    'react-native': { AppState: { currentState: 'background' }, Linking: {}, Platform: { OS: 'android' } },
    'expo-notifications': { registerTaskAsync: async () => {} },
    'expo-task-manager': { isTaskDefined: () => false, defineTask: (_name, handler) => { task = handler; } },
    '@react-native-async-storage/async-storage': { setItem: async () => {}, getItem: async () => null },
    'react-native-notify-kit': { ...notify, ...enums },
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } } }) }, from: () => query } },
  };
  const code = ts.transpileModule(readFileSync(`${__dirname}/runtime.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: id => mocks[id], console, Date });
  return { api: module.exports, invite, displayed, filters, writes, canceled, task: data => task({ data }) };
}
test('headless dataString creates a bounded high-importance CALL notification', async () => {
  const h = harness(); await h.task({ data: { dataString: JSON.stringify(h.invite) } });
  const [notification] = h.displayed;
  assert.equal(notification.android.category, 'call'); assert.equal(notification.android.importance, 4);
  assert(notification.android.timeoutAfter > 0 && notification.android.timeoutAfter <= 40_000);
  assert.equal(notification.android.fullScreenAction.launchActivity, 'default');
  assert.equal(notification.android.actions[1].pressAction.launchActivity, undefined);
});
test('expired and different-recipient pushes never display', async () => {
  const h = harness(); await h.api.showIncoming({ ...h.invite, expiresAt: new Date(Date.now() - 1).toISOString() });
  await h.api.showIncoming({ ...h.invite, recipientId: 'someone-else' }); assert.equal(h.displayed.length, 0);
});
test('Decline scopes a durable terminal write without launching the activity', async () => {
  const h = harness(); await h.api.handleRingingEvent({ type: 2, detail: { pressAction: { id: 'decline' }, notification: { data: h.invite } } });
  assert.equal(h.writes[0].status, 'declined');
  assert(h.filters.some(([key, value]) => key === 'couple_id' && value === 'couple'));
  assert(h.filters.some(([key, value]) => key === 'not-caller_id' && value === 'me'));
  assert.equal(h.canceled[0], `call-${h.invite.callId}`);
});

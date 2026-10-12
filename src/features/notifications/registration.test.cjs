const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness({ granted = true, accept = true, currentUser = 'owner' } = {}) {
  const channels = []; const saves = []; const events = []; const prompts = new Map();
  const mocks = {
    '@react-native-async-storage/async-storage': { getItem: async (key) => prompts.get(key), setItem: async (key, value) => prompts.set(key, value) },
    'react-native': { Platform: { OS: 'android' }, Linking: { openSettings() {} }, Alert: { alert: (_title, _message, buttons) => {
      events.push('pre-prompt'); buttons[accept ? 1 : 0].onPress();
    } } },
    'expo-constants': { expoConfig: { extra: { eas: { projectId: 'configured-project' } } } },
    'expo-device': { isDevice: true },
    'expo-notifications': {
      AndroidImportance: { DEFAULT: 3, MAX: 5 }, AndroidNotificationVisibility: { PUBLIC: 1 },
      setNotificationChannelAsync: async (id, config) => { channels.push({ id, config }); events.push(id); },
      getPermissionsAsync: async () => ({ granted, canAskAgain: true }),
      requestPermissionsAsync: async () => { events.push('android-permission'); return { granted: true, canAskAgain: true }; },
      getExpoPushTokenAsync: async ({ projectId }) => { assert.equal(projectId, 'configured-project'); return { data: 'ExpoPushToken[device]' }; },
    },
    '@/lib/supabase': { supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: currentUser } } } }) },
      from: (table) => {
        assert.equal(table, 'push_tokens');
        return { upsert: async (value, options) => { saves.push({ value, options }); return { error: null }; },
          delete: () => ({ eq: (_column, user) => ({ eq: async (column, token) => {
            assert.equal(column, 'token'); assert.equal(token, 'ExpoPushToken[device]');
            events.push(`delete:${user}`); return { error: null };
          } }) }) };
      },
    } },
  };
  const code = ts.transpileModule(fs.readFileSync(`${__dirname}/service.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date, require: (name) => mocks[name] });
  return { ...module.exports, channels, saves, events };
}

test('creates both channels before permission prompt and saves owner token with conflict key', async () => {
  const h = harness({ granted: false });
  assert.equal(await h.registerPush('owner'), true);
  assert.deepEqual(h.events.slice(0, 4), ['messages', 'calls', 'pre-prompt', 'android-permission']);
  assert.equal(h.channels[0].config.importance, 3); assert.equal(h.channels[1].config.importance, 5);
  assert.equal(h.channels[1].config.enableVibrate, true);
  assert.equal(h.saves[0].value.user_id, 'owner'); assert.equal(h.saves[0].options.onConflict, 'user_id');
});
test('Not now never requests permission or saves a token, and automatic refresh does not prompt again', async () => {
  const h = harness({ granted: false, accept: false });
  assert.equal(await h.registerPush('owner'), false);
  assert.equal(await h.registerPush('owner'), false);
  assert.equal(h.events.filter((event) => event === 'pre-prompt').length, 1);
  assert.equal(h.events.includes('android-permission'), false); assert.equal(h.saves.length, 0);
});
test('session changed during registration never writes the old owner token', async () => {
  const h = harness({ currentUser: 'new-owner' });
  assert.equal(await h.registerPush('old-owner'), false); assert.equal(h.saves.length, 0);
});
test('sign-out cleanup waits for in-flight registration before removing its token', async () => {
  const h = harness();
  const register = h.registerPush('owner');
  await h.unregisterPush('owner'); await register;
  assert.equal(h.saves.length, 1); assert.equal(h.events.at(-1), 'delete:owner');
});

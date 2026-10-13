const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness(headless = true) {
  const uid = '11111111-1111-4111-8111-111111111111';
  const coupleId = '22222222-2222-4222-8222-222222222222';
  const memory = new Map(), tasks = new Map(), writes = [], notices = [], intervals = [];
  let row = null, deleteFails = false, blocked = false, level = 0.7, background = true;
  let positionGate;
  let now = Date.now();
  const state = { lease: null, error: null, pendingStop: false, ready: false };
  const timers = new Set();
  const store = { setState: update => Object.assign(state, update), getState: () => state };
  const storage = { getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => { memory.set(key, value); }, removeItem: async key => { memory.delete(key); } };
  const position = () => ({ timestamp: now, coords: { latitude: 12.9, longitude: 77.5, accuracy: 10, speed: 2, heading: 90, altitude: null, altitudeAccuracy: null } });
  const db = { from(table) {
    let operation = 'select', payload, filters = [];
    const query = {
      select() { return query; }, upsert(value) { operation = 'upsert'; payload = value; return query; },
      update(value) { operation = 'update'; payload = value; return query; }, insert(value) { operation = 'insert'; payload = value; return query; },
      delete() { operation = 'delete'; return query; }, eq(key, value) { filters.push([key, value]); return query; },
      order() { return query; }, maybeSingle() { query.single = true; return query; }, abortSignal() { return query; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          if (table === 'saved_places') return { data: [], error: null };
          if (table === 'journeys') return { data: query.single ? null : [], error: null };
          writes.push({ operation, payload, filters });
          if (operation === 'delete') { if (deleteFails) return { error: { code: 'offline' } }; row = null; return { error: null }; }
          if (operation === 'upsert') row = { ...payload };
          if (operation === 'update' && row && filters.every(([key, value]) => row[key] === value)) row = { ...payload };
          return { data: query.single ? row : row ? [row] : [], error: null };
        }).then(resolve, reject);
      },
    };
    return query;
  } };
  const notifee = {
    registerForegroundService: () => {}, onBackgroundEvent: handler => { tasks.set('stop-notification', handler); },
    requestPermission: async () => ({ authorizationStatus: blocked ? 0 : 1 }), getNotificationSettings: async () => ({ authorizationStatus: 1 }),
    createChannel: async () => {}, getChannel: async () => ({ blocked }), displayNotification: async notice => notices.push(notice),
    cancelNotification: async () => {}, stopForegroundService: async () => {},
  };
  const modules = {
    '@react-native-async-storage/async-storage': { default: storage },
    'expo-location': { Accuracy: { Balanced: 3, High: 4 }, GeofencingEventType: { Enter: 1, Exit: 2 },
      getForegroundPermissionsAsync: async () => ({ granted: true }), requestBackgroundPermissionsAsync: async () => ({ granted: background }),
      getBackgroundPermissionsAsync: async () => ({ granted: background }),
      startLocationUpdatesAsync: async (_, options) => intervals.push(options.timeInterval),
      hasStartedLocationUpdatesAsync: async () => true, stopLocationUpdatesAsync: async () => {},
      hasStartedGeofencingAsync: async () => false, stopGeofencingAsync: async () => {},
      startGeofencingAsync: async () => {}, getCurrentPositionAsync: async () => { if (positionGate) await positionGate; return position(); },
    },
    'expo-task-manager': { defineTask: (name, handler) => tasks.set(name, handler) },
    'expo-battery': { getBatteryLevelAsync: async () => level, getBatteryStateAsync: async () => 1, BatteryState: { UNKNOWN: 0, CHARGING: 2, FULL: 3 } },
    'expo-crypto': { randomUUID: () => '33333333-3333-4333-8333-333333333333' },
    'react-native-notify-kit': { default: notifee, AndroidImportance: { DEFAULT: 3 }, AuthorizationStatus: { AUTHORIZED: 1 }, AndroidForegroundServiceType: { FOREGROUND_SERVICE_TYPE_LOCATION: 8 }, EventType: { ACTION_PRESS: 2 } },
    'react-native': { Platform: { OS: 'android' } },
    '@/lib/supabase': { supabase: { auth: { onAuthStateChange: handler => tasks.set('auth-change', handler), getSession: async () => ({ data: { session: { user: { id: uid } } } }) }, functions: { invoke: async (_, request) => { notices.push(request.body); return { error: null }; } } } },
    '@/lib/data/feature-client': { featureSupabase: db }, './store': { useLocationState: store },
  };
  const cache = {};
  const load = name => {
    if (modules[name]) return { __esModule: true, ...modules[name] };
    if (!name.startsWith('.')) return require(name);
    if (cache[name]) return cache[name];
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const exports = {};
    cache[name] = exports;
    vm.runInNewContext(code, { exports, require: load, console, AbortSignal, Date: class extends Date { static now() { return now; } },
      setTimeout: (fn, ms) => { const timer = { fn, ms }; timers.add(timer); return timer; }, clearTimeout: timer => timers.delete(timer),
    }, { filename: name });
    return exports;
  };
  const runtime = load('./runtime');
  if (headless) runtime.markLocationHeadlessEntry();
  return { runtime, geo: load('./geo'), uid, coupleId, memory, state, writes, notices, tasks, timers, intervals, position,
    setOffline: value => { deleteFails = value; }, setBlocked: value => { blocked = value; }, setBackground: value => { background = value; },
    setLevel: value => { level = value; }, advance: ms => { now += ms; }, gatePosition: value => { positionGate = value; }, row: () => row,
  };
}

test('default is OFF: registering tasks publishes no point and requests no permission', () => {
  const h = harness();
  assert.equal(h.state.lease, null); assert.equal(h.writes.length, 0); assert.equal(h.notices.length, 0);
  assert.ok(h.tasks.has('us-location-latest-v1'));
});
test('sharing fails closed without the shared cold-headless entry import', async () => {
  const h = harness(false);
  await assert.rejects(h.runtime.startSharing(h.uid, h.coupleId, 'hour'), /setup is incomplete/);
  assert.equal(h.row(), null); assert.equal(h.state.lease, null); assert.equal(h.notices.length, 0);
});
test('sharing creates one latest row, Stop deletes it and stale callbacks cannot recreate it', async () => {
  const h = harness();
  await h.runtime.startSharing(h.uid, h.coupleId, 'hour');
  assert.ok(h.row()); assert.equal(h.notices[0].android.actions[0].title, 'Stop'); assert.ok(h.timers.size);
  await h.runtime.stopSharing();
  assert.equal(h.row(), null); assert.equal(h.state.lease, null); assert.equal(h.timers.size, 0);
  await h.tasks.get('us-location-latest-v1')({ data: { locations: [h.position()] } });
  assert.equal(h.row(), null); assert.equal(h.writes.filter(w => w.operation === 'upsert').length, 1);
  assert.equal(h.memory.has('location:consent:v1'), false);
});
test('offline Stop persists deletion and retry removes the server point', async () => {
  const h = harness(); await h.runtime.startSharing(h.uid, h.coupleId, 'hour'); h.setOffline(true);
  await assert.rejects(h.runtime.stopSharing(), /Server deletion is pending/);
  assert.equal(h.state.lease, null); assert.equal(h.state.pendingStop, true); assert.ok(h.memory.has('location:pending-stop:v1'));
  h.setOffline(false); await h.runtime.retryDeletion(); assert.equal(h.row(), null); assert.equal(h.state.pendingStop, false);
});
test('notification permission and background permission denial leave sharing OFF', async () => {
  for (const reason of ['notifications', 'background']) {
    const h = harness(); if (reason === 'notifications') h.setBlocked(true); else h.setBackground(false);
    await assert.rejects(h.runtime.startSharing(h.uid, h.coupleId, 'hour'));
    assert.equal(h.row(), null); assert.equal(h.state.lease, null); assert.equal(h.memory.has('location:consent:v1'), false);
  }
});
test('expiry stops even without another GPS fix', async () => {
  const h = harness(); await h.runtime.startSharing(h.uid, h.coupleId, 'hour');
  const timer = [...h.timers][0]; assert.ok(timer.ms <= 3_600_000); h.advance(3_600_001); timer.fn();
  await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.state.lease, null); assert.equal(h.row(), null);
});
test('recovery compares timestamp instants, including Postgres timezone normalization', async () => {
  const h = harness(); await h.runtime.startSharing(h.uid, h.coupleId, 'hour');
  h.row().sharing_until = h.row().sharing_until.replace('Z', '+00:00');
  await h.runtime.restoreSharing(h.uid, h.coupleId);
  assert.ok(h.state.lease); assert.ok(h.row());
  assert.equal(h.geo.sameExpiry('2026-10-13T12:00:00.000Z', '2026-10-13T12:00:00+00:00'), true);
});
test('Stop during initial GPS acquisition prevents the initial server insert', async () => {
  const h = harness(); let release; h.gatePosition(new Promise(resolve => { release = resolve; }));
  const starting = h.runtime.startSharing(h.uid, h.coupleId, 'hour');
  for (let index = 0; index < 8; index++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(h.state.lease);
  const stopping = h.runtime.stopSharing(); release(); await starting; await stopping;
  assert.equal(h.row(), null); assert.equal(h.writes.filter(w => w.operation === 'upsert').length, 0);
});
test('background updates use UPDATE only and adapt to speed; storage never contains coordinates', async () => {
  const h = harness(); await h.runtime.startSharing(h.uid, h.coupleId, 'hour'); h.advance(21_000);
  const position = h.position(); position.coords.speed = 8;
  await h.tasks.get('us-location-latest-v1')({ data: { locations: [position] } });
  assert.equal(h.writes.filter(w => w.operation === 'upsert').length, 1); assert.ok(h.writes.some(w => w.operation === 'update'));
  assert.equal(h.intervals.at(-1), 10_000);
  assert.ok([...h.memory.values()].every(value => !value.includes('latitude') && !value.includes('"lat"') && !value.includes('"lon"')));
});
test('battery alerts fire once below 15 and at 5, reset only after recovery', async () => {
  const h = harness(); h.setLevel(0.14); await h.runtime.startSharing(h.uid, h.coupleId, 'hour');
  h.advance(21_000); await h.tasks.get('us-location-latest-v1')({ data: { locations: [h.position()] } });
  assert.equal(h.notices.filter(n => n.channel === 'location').length, 1);
  h.setLevel(0.05); h.advance(21_000); await h.tasks.get('us-location-latest-v1')({ data: { locations: [h.position()] } });
  assert.equal(h.notices.filter(n => n.channel === 'location').length, 2);
  assert.ok(h.notices.filter(n => n.channel === 'location').every(n => n.data.route === '/us/location'));
});
test('distance, expiry boundaries and frequency thresholds', () => {
  const h = harness();
  assert.equal(h.geo.isLive(new Date(1000).toISOString(), 1000), false); assert.equal(h.geo.isLive('infinity'), true);
  assert.equal(h.geo.expiry('eight', 0), new Date(28_800_000).toISOString());
  assert.equal(h.geo.updateInterval(null), 300_000); assert.equal(h.geo.updateInterval(1), 20_000); assert.equal(h.geo.updateInterval(5), 10_000);
  assert.equal(h.geo.distance({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }), 0);
  assert.ok(Math.abs(h.geo.distance({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111195) < 2);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(name, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(`${__dirname}/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: id => { assert(id in dependencies, `Unexpected import ${id}`); return dependencies[id]; }, ...globals });
  return exports;
}
async function main() {
  const bank = load('questions'); assert.equal(bank.questions.length, 365); assert.equal(new Set(bank.questions).size, 365);
  const calendar = load('calendar', { './questions': bank });
  const cycle = new Set(); for (let i = 0; i < 365; i++) cycle.add(calendar.questionFor(new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10)));
  assert.equal(cycle.size, 365, 'Leap-year dates must not repeat a question early');
  assert.equal(calendar.streak(['2024-02-28', '2024-02-29'], '2024-03-01'), 2);
  assert.equal(calendar.streak(['2024-02-28', '2024-03-01'], '2024-03-01'), 1);
  assert.equal(calendar.streak([], '2024-03-01'), 0);
  let time = 100_000; class FakeDate extends Date { static now() { return time; } }
  const state = { currentState: 'active' }; const storage = new Map(); let pushes = 0; let counts = 0; let broadcasts = 0; let present = true;
  const service = load('service', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async k => storage.get(k) ?? null, setItem: async (k, v) => storage.set(k, v) } },
    '@/lib/supabase': { supabase: { functions: { invoke: async (_name, { body }) => { assert.equal(body.channel, 'pulse'); assert.equal(body.data.route, '/us/pulse'); pushes++; return { error: null }; } } } }
  }, { Date: FakeDate });
  await Promise.all([service.notifyPulse('same', 'hello', 600_000), service.notifyPulse('same', 'hello', 600_000)]);
  assert.equal(pushes, 1, 'Concurrent sends must not duplicate pushes');
  time += 1000; await service.notifyPulse('same', 'hello', 600_000); assert.equal(pushes, 1);
  time += 600_000; await service.notifyPulse('same', 'hello', 600_000); assert.equal(pushes, 2);
  const transport = load('heartbeat', {
    'react-native': { AppState: state }, '@/lib/couple-time': { todayKey: () => '2026-10-13' },
    './service': { limits: service.limits, identity: async () => ({ userId: 'a', coupleId: 'us' }), notifyPulse: service.notifyPulse,
      pulseDb: { from: table => { assert.equal(table, 'pulse_heartbeats'); return { insert: async row => { assert.equal(row.couple_id, 'us'); counts++; return { error: null }; } }; } } }
  }, { Date: FakeDate });
  const detach = transport.attachHeartbeat({ userId: 'a', coupleId: 'us', timezone: 'Asia/Kolkata', partnerPresent: () => present, channel: { send: async () => { broadcasts++; return 'ok'; } } });
  assert.equal(await transport.sendHeartbeat(), 'live'); assert.equal(counts, 1); assert.equal(broadcasts, 1);
  assert.equal(await transport.sendHeartbeat(), 'throttled'); assert.equal(counts, 1);
  time += 900; assert.equal(await transport.sendHeartbeat(true, true), 'live'); assert.equal(counts, 1); assert.equal(broadcasts, 2);
  present = false; time += 900; assert.equal(await transport.sendHeartbeat(), 'push'); assert.equal(broadcasts, 2); assert.equal(counts, 2); assert.equal(pushes, 3);
  time += 900; await transport.sendHeartbeat(); assert.equal(pushes, 3, 'Offline partner push cooldown must persist');
  state.currentState = 'background'; time += 900; const previousCounts = counts;
  assert.equal(await transport.sendHeartbeat(), 'throttled'); assert.equal(counts, previousCounts); assert.equal(broadcasts, 2);
  detach(); console.log('PASS: 365 unique prompts, leap-day cycle/streaks, push concurrency/cooldown, presence gating, hold counting, throttle and background suppression');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

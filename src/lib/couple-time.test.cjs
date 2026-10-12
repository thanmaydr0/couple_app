const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/couple-time.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports, Date, Intl, require: () => ({ useCouple: () => ({}) }) });
const time = mod.exports;
test('today follows couple timezone across UTC midnight', () => {
  const instant = new Date('2026-10-12T20:00:00Z');
  assert.equal(time.todayKey('Asia/Kolkata', instant), '2026-10-13');
  assert.equal(time.todayKey('America/New_York', instant), '2026-10-12');
  assert.equal(time.coupleTimezone({ timezone: 'invalid' }), 'Asia/Kolkata');
});
test('wall clock conversion handles offsets and refuses DST gaps/overlaps', () => {
  assert.equal(time.zonedTimeToUtc('2026-10-13T09:00', 'Asia/Kolkata').toISOString(), '2026-10-13T03:30:00.000Z');
  assert.equal(time.zonedTimeToUtc('2026-10-13T09:00', 'Asia/Kathmandu').toISOString(), '2026-10-13T03:15:00.000Z');
  assert.throws(() => time.zonedTimeToUtc('2026-03-08T02:30', 'America/New_York'), /skipped or repeated/);
  assert.throws(() => time.zonedTimeToUtc('2026-11-01T01:30', 'America/New_York'), /skipped or repeated/);
  assert.throws(() => time.zonedTimeToUtc('2026-02-30T09:00', 'UTC'), /Invalid date/);
  const result = time.partnerTimes('2026-10-13T03:30:00Z', 'Asia/Kolkata', 'UTC');
  assert.match(result.yours, /9:00/); assert.match(result.partner, /3:30/);
});

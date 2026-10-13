const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(join(__dirname, 'time.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: moduleObject.exports, module: moduleObject, Intl, Date, Set });
const { fromWall, wall, findWindows, expand, generated, dayKey, DAY } = moduleObject.exports;
const test = require('node:test');
const you = { id: 'a', display_name: 'A', timezone: 'America/New_York' };
const them = { id: 'b', display_name: 'B', timezone: 'Asia/Kolkata' };
const event = { id:'e',couple_id:'c',title:'Date',starts_at:'2026-03-01T15:00:00Z',ends_at:'2026-03-01T16:00:00Z',all_day:false,location:null,notes:null,kind:'date',status:'confirmed',proposed_by:null,repeat:'weekly',remind_minutes:[60],created_by:'a',created_at:'2026-01-01T00:00Z' };
test('timezone conversion handles half-hour and quarter-hour offsets', () => {
 assert.equal(new Date(fromWall('2026-10-17T20:00','Asia/Kolkata')).toISOString(),'2026-10-17T14:30:00.000Z');
 assert.equal(new Date(fromWall('2026-10-17T20:00','Asia/Kathmandu')).toISOString(),'2026-10-17T14:15:00.000Z');
});
test('rejects DST gaps, folds and invalid dates', () => {
 for(const s of ['2026-03-08T02:30','2026-11-01T01:30','2026-02-30T12:00']) assert.throws(()=>fromWall(s,'America/New_York'));
 assert.throws(()=>fromWall('2026-10-17T20:00','invalid'));
});
test('weekly recurrence preserves wall clock across spring DST', () => {
 const rows=expand([event],[you],Date.parse('2026-03-01'),Date.parse('2026-03-20'));
 assert.equal(rows.length,3); assert.equal(rows[1].starts_at,'2026-03-08T14:00:00.000Z');
 assert.equal(wall(rows[1].starts_at,you.timezone),'2026-03-08T10:00');
});
test('monthly clamps January 31 and yearly clamps February 29', () => {
 const rows=expand([{...event,starts_at:'2026-01-31T15:00Z',ends_at:'2026-01-31T16:00Z',repeat:'monthly'}],[you],Date.parse('2026-02-01'),Date.parse('2026-04-01'));
 assert.equal(wall(rows[0].starts_at,you.timezone),'2026-02-28T10:00'); assert.equal(wall(rows[1].starts_at,you.timezone),'2026-03-31T10:00');
 const leap=expand([{...event,starts_at:'2024-02-29T15:00Z',ends_at:'2024-02-29T16:00Z',repeat:'yearly'}],[you],Date.parse('2025-02-01'),Date.parse('2025-03-01'));
 assert.equal(leap[0].starts_at,'2025-02-28T15:00:00.000Z');
});
test('all-day dates do not shift in Los Angeles or Auckland',()=>{
 const e={...event,all_day:true,starts_at:'2026-10-17T00:00Z',ends_at:'2026-10-18T00:00Z',repeat:'none'};
 assert.equal(dayKey(e,'America/Los_Angeles'),'2026-10-17');assert.equal(dayKey(e,'Pacific/Auckland'),'2026-10-17');
});
test('next five windows intersect both zones and retain half-hour boundaries',()=>{
 const rows=[{user_id:'a',couple_id:'c',weekday:6,start_minute:600,end_minute:720,tz:you.timezone},{user_id:'b',couple_id:'c',weekday:6,start_minute:1170,end_minute:1290,tz:them.timezone}];
 const windows=findWindows(rows,you,them,Date.parse('2026-10-16T00:00Z'));
 assert.equal(windows.length,5);assert.equal(new Date(windows[0].start).toISOString(),'2026-10-17T14:00:00.000Z'); assert.equal(windows[0].end-windows[0].start,2*60*60_000);
 assert.equal(wall(windows[3].start,you.timezone),'2026-11-07T10:00');
});
test('overlap scan handles nonexistent DST hour and empty availability',()=>{
 const rows=[{user_id:'a',couple_id:'c',weekday:0,start_minute:120,end_minute:180,tz:you.timezone},{user_id:'b',couple_id:'c',weekday:0,start_minute:0,end_minute:1440,tz:'UTC'}];
 const windows=findWindows(rows,you,{...them,timezone:'UTC'},Date.parse('2026-03-08T00:00Z'));
 assert.equal(new Date(windows[0].start).toISOString().slice(0,10),'2026-03-15'); assert.equal(findWindows([],you,them).length,0);
});
test('automatic birthdays, anniversary and day 100 are read-only; declined excluded',()=>{
 const from=Date.parse('2026-01-01'),until=Date.parse('2027-01-01');
 const rows=generated('c','2026-01-01',[{...you,birthday:'1999-05-03'},{...them,birthday:'2000-10-09'}],from,until);
 assert.ok(rows.some(e=>e.title==='Day 100 together'&&e.starts_at.slice(0,10)==='2026-04-11'));
 assert.equal(rows.filter(e=>e.kind==='birthday').length,2);assert.ok(rows.every(e=>e.readonly));
 assert.equal(expand([{...event,status:'declined'}],[you],from,until).length,0);
});

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, 'clock.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const clock = { exports: {} };
new Function('exports', 'module', compiled)(clock.exports, clock);
const { phaseAt, statistics } = clock.exports;
const start = Date.parse('2026-10-13T00:00:00Z');
const session = { id:'room', started_at:new Date(start).toISOString(), work_sec:1500, break_sec:300, cycles:2, status:'active' };
assert.equal(phaseAt(session,start).remaining,1500);
assert.equal(phaseAt(session,start+1500_000).phase,'Rest');
assert.equal(phaseAt(session,start+1800_000).phase,'Focus');
assert.equal(phaseAt(session,start+1800_000).cycle,2);
assert.equal(phaseAt(session,start+2100_000).remaining,1200); // resume after 35 minutes
assert.equal(phaseAt(session,start+3300_000).phase,'Finished'); // no final break
assert.equal(phaseAt({...session,cycles:1},start+1500_000).phase,'Finished');
assert.equal(phaseAt({...session,status:'cancelled'},start+1000).remaining,0);
assert.equal(phaseAt(session,start-5000).remaining,1500); // negative skew clamps
const logs=[{day:'2026-10-12',minutes:25,user_id:'me'},{day:'2026-10-12',minutes:50,user_id:'me'},{day:'2026-10-11',minutes:25,user_id:'them'},{day:'2026-10-13',minutes:0,user_id:'me'}];
const stats=statistics(logs,'me',start);
assert.equal(stats.streak,2);assert.equal(stats.best,75);assert.equal(stats.bars.at(-2).you,75);
assert.equal(statistics([],'me',start).streak,0);
console.log('Focus: 12 timer boundary, resume, cancellation and statistics assertions passed.');

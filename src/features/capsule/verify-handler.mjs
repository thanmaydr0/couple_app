import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../../../supabase/functions/scheduler/handlers/capsule_unlock.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { capsule_unlock } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const runAt = new Date(Date.now() - 60_000).toISOString();
const id = '00000000-0000-4000-8000-000000000001';
const job = { id: 'job', couple_id: 'couple', kind: 'capsule_unlock', run_at: runAt, payload: { capsule_id: id }, created_by: 'author', attempts: 1 };
let notified = 0; let row = { id, author_id: 'author', unlock_at: runAt }; let fail = false;
const scopes = [];
const admin = { from(table) {
  const builder = {
    select() { return builder; }, eq(column, value) { scopes.push([table, column, value]); return builder; }, abortSignal() { return builder; },
    async maybeSingle() { return { data: row, error: null }; },
    then(resolve, reject) { return Promise.resolve({ data: [{ id: 'author' }, { id: 'partner' }], error: null }).then(resolve, reject); },
  };
  return builder;
}, functions: { async invoke(name, options) {
  assert.equal(name, 'notify-partner'); assert.equal(options.body.channel, 'capsule'); assert.equal(options.body.scheduler_job_id, 'job');
  assert.equal(options.body.data.route, '/us/capsule'); assert(!('recipient_id' in options.body));
  notified++; return { error: fail ? new Error('Unauthorized') : null };
} } };
const context = { admin, signal: new AbortController().signal };
await capsule_unlock(job, context); assert.equal(notified, 1);
assert(scopes.some(([table, column, value]) => table === 'capsules' && column === 'couple_id' && value === 'couple'));
row = null; await capsule_unlock(job, context); assert.equal(notified, 1);
row = { id, author_id: 'author', unlock_at: new Date(Date.now() + 60_000).toISOString() };
await capsule_unlock(job, context); assert.equal(notified, 1, 'Rescheduled claimed job must be ignored');
row = { id, author_id: 'outsider', unlock_at: runAt }; await capsule_unlock(job, context); assert.equal(notified, 1);
row = { id, author_id: 'author', unlock_at: runAt }; fail = true;
await assert.rejects(capsule_unlock(job, context), /service scheduler contract/);
const cancelled = new AbortController(); cancelled.abort();
await assert.rejects(capsule_unlock(job, { admin, signal: cancelled.signal }));
console.log('PASS handler scope, membership, deleted/rescheduled jobs, notification contract, retryable failure, abort');

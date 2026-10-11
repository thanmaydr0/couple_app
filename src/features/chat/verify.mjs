import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Exercise the actual pure TypeScript model without loading Expo native code.
const source = readFileSync(new URL('./model.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const model = {};
new Function('exports', compiled)(model);
const { mergeMessages, cacheWindow, dayLabel, grouped, isMessage } = model;
const row = (id, extra = {}) => ({ id, client_id: id, couple_id: 'couple', sender_id: 'me', kind: 'text', body: 'Hi ♥', media_path: null, reply_to: null, created_at: '2026-10-12T10:00:00Z', read_at: null, status: 'sent', ...extra });

test('realtime echo replaces optimism; late failure cannot downgrade it', () => {
  const pending = row('client', { status: 'sending', localUri: 'file://photo' });
  const echoed = row('server', { client_id: 'client' });
  const sent = mergeMessages([pending], [echoed]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].id, 'server');
  assert.equal(sent[0].localUri, undefined);
  assert.deepEqual(mergeMessages(sent, [{ ...pending, status: 'failed' }]), sent);
});

test('a stale INSERT/history response never rolls back a receipt', () => {
  const read = row('1', { read_at: '2026-10-12T10:02:00Z' });
  assert.equal(mergeMessages([read], [row('1')])[0].read_at, read.read_at);
});

test('out-of-order pages merge newest first with an ID tie breaker', () => {
  const merged = mergeMessages([row('a')], [row('b'), row('c', { created_at: '2026-10-11T10:00:00Z' }), row('a')]);
  assert.deepEqual(merged.map((message) => message.id), ['b', 'a', 'c']);
});

test('offline cache stays bounded and preserves retryable outbox messages', () => {
  const messages = Array.from({ length: 250 }, (_, index) => row(String(index), { created_at: new Date(Date.UTC(2026, 9, 12, 0, index)).toISOString() }));
  const failed = row('failed', { status: 'failed', created_at: '2026-01-01T00:00:00Z' });
  const cached = cacheWindow([...messages, failed]);
  assert.equal(cached.length, 200);
  assert.ok(cached.some((message) => message.id === 'failed'));
  assert.equal(cacheWindow(Array.from({ length: 250 }, (_, index) => row(String(index), { status: 'failed' }))).length, 200);
});

test('groups only nearby messages from the same sender and calendar day', () => {
  const first = row('a');
  assert.equal(grouped(first, row('b', { created_at: '2026-10-12T10:03:00Z' })), true);
  assert.equal(grouped(first, row('b', { sender_id: 'partner' })), false);
  assert.equal(grouped(first, row('b', { created_at: '2026-10-12T10:06:00Z' })), false);
  assert.equal(grouped(first, undefined), false);
  const midnight = new Date(2026, 9, 12, 0, 1).toISOString();
  const before = new Date(2026, 9, 11, 23, 59).toISOString();
  assert.equal(grouped(row('a', { created_at: midnight }), row('b', { created_at: before })), false);
});

test('Today and Yesterday follow local calendar boundaries', () => {
  const now = new Date(2026, 9, 12, 12);
  assert.equal(dayLabel(new Date(2026, 9, 12, 0).toISOString(), now), 'Today');
  assert.equal(dayLabel(new Date(2026, 9, 11, 23).toISOString(), now), 'Yesterday');
  assert.notEqual(dayLabel(new Date(2026, 9, 10, 23).toISOString(), now), 'Yesterday');
});

test('rejects malformed persisted/network rows before reconciliation', () => {
  assert.equal(isMessage(row('ok')), true);
  assert.equal(isMessage({ ...row('bad'), created_at: 'garbage' }), false);
  assert.equal(isMessage({ ...row('bad'), read_at: 123 }), false);
  assert.equal(isMessage({ ...row('bad'), kind: 'unknown' }), false);
  assert.equal(isMessage(null), false);
});

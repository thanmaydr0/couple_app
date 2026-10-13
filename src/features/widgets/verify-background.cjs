const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let task, refreshes = 0, draws = 0;
const state = { enabled: true, owner: 'alice', couple: 'pair' };
const dependencies = {
  'expo-task-manager': { defineTask: (_name, handler) => { task = handler; } },
  'expo-notifications': { registerTaskAsync: async () => {} },
  './service': { readState: async () => state, refreshData: async () => { refreshes++; return state; }, writeState: async () => {} },
  './widget-task-handler': { renderAll: async () => { draws++; } },
};
const code = ts.transpileModule(fs.readFileSync(`${__dirname}/background.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(code, { exports: {}, require: id => { assert(id in dependencies, id); return dependencies[id]; } });
async function main() {
  const payload = { widgetRefresh: true, recipientId: 'alice', coupleId: 'pair' };
  await task({ data: { data: { dataString: '{broken' } } });
  await task({ data: { data: { ...payload, recipientId: 'other' } } });
  await task({ data: { data: { ...payload, coupleId: 'other' } } });
  await task({ error: new Error('No delivery'), data: { data: payload } });
  assert.equal(refreshes, 0);
  await task({ data: { data: { dataString: JSON.stringify(payload) } } });
  assert.equal(refreshes, 1); assert.equal(draws, 1);
  await task({ data: { actionIdentifier: 'default', notification: { request: { content: { data: payload } } } } });
  assert.equal(refreshes, 2);
  state.enabled = false;
  await task({ data: { data: payload } });
  assert.equal(refreshes, 2);
  console.log('PASS: background task rejects malformed, mismatched, failed and disabled payloads; accepts data-string and notification payloads and requests redraw.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

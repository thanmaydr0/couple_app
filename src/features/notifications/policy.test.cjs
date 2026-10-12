const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(`${__dirname}/policy.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const policy = {};
new Function('exports', compiled)(policy);

test('messages are suppressed when chat is open or the message is already read', () => {
  for (const data of [{ type: 'message' }, { message_id: 'legacy-message' }]) {
    assert.equal(policy.showForeground(data, true, false), false);
    assert.equal(policy.showForeground(data, false, true), false);
    assert.equal(policy.showForeground(data, false, false), true);
  }
});
test('calls and remote tests always present, including while chat is open', () => {
  assert.equal(policy.showForeground({ type: 'call' }, true, true), true);
  assert.equal(policy.showForeground({ type: 'test' }, true, true), true);
  assert.equal(policy.notificationType({ url: 'https://untrusted.example' }), null);
});

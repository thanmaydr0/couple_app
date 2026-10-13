const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomBytes, scryptSync } = require('node:crypto');
const ts = require('typescript');
const vm = require('node:vm');
const nacl = require('tweetnacl');
const source = ts.transpileModule(readFileSync(`${__dirname}/crypto.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(source, { exports: moduleObject.exports, module: moduleObject, require, Uint8Array, setTimeout });
const c = moduleObject.exports;
const random = n => new Uint8Array(randomBytes(n));
const context = { couple: 'couple', author: 'alice', client: 'message-1', kind: 'text' };
const alice = c.keyPair(random), bob = c.keyPair(random);
test('RFC 7748 X25519 known answer and shared secret', () => {
  const secret = new Uint8Array(Buffer.from('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a', 'hex'));
  const expected = '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a';
  assert.equal(Buffer.from(nacl.box.keyPair.fromSecretKey(secret).publicKey).toString('hex'), expected);
  assert.deepEqual(nacl.box.before(bob.publicKey, alice.secretKey), nacl.box.before(alice.publicKey, bob.secretKey));
});
test('both sender and partner decrypt Unicode payload, meta and wrapped file key', () => {
  const payload = { body: 'hello ❤️ नमस्ते', meta: { peaks: [0.2], duration_ms: 1000 }, file: { key: c.b64(random(32)) } };
  const wire = c.encrypt(payload, context, alice.secretKey, c.b64(bob.publicKey), random);
  assert.equal(wire.v, 1); assert(!JSON.stringify(wire).includes(payload.body));
  assert.equal(JSON.stringify(c.decrypt(wire, context, bob.secretKey)), JSON.stringify(payload));
  assert.equal(JSON.stringify(c.decrypt(wire, context, alice.secretKey)), JSON.stringify(payload));
});
test('tampered ciphertext, nonce, wrong key, version and replay context fail closed', () => {
  const wire = c.encrypt('private', context, alice.secretKey, c.b64(bob.publicKey), random);
  const corrupt = c.bytes(wire.ciphertext); corrupt[0] ^= 1;
  for (const altered of [{ ...wire, ciphertext: c.b64(corrupt) }, { ...wire, nonce: c.b64(random(24)) }, { ...wire, v: 2 }]) {
    assert.throws(() => c.decrypt(altered, context, bob.secretKey));
  }
  assert.throws(() => c.decrypt(wire, context, c.keyPair(random).secretKey));
  for (const field of ['couple', 'author', 'client', 'kind']) assert.throws(() => c.decrypt(wire, { ...context, [field]: 'different' }, bob.secretKey));
});
test('low order and malformed public keys rejected', () => {
  for (const pub of [new Uint8Array(32), new Uint8Array(31)]) assert.throws(() => c.encrypt('x', context, alice.secretKey, c.b64(pub), random));
});
test('10,000 random 192-bit nonces are unique', () => {
  const values = new Set(); const key = random(32);
  for (let i = 0; i < 10000; i++) values.add(c.seal(new Uint8Array([1]), key, random).nonce);
  assert.equal(values.size, 10000);
});
test('attachment encryption authenticates all bytes and wrong key fails', () => {
  const key = random(32), data = random(8192), wire = c.seal(data, key, random);
  assert.deepEqual(c.open(wire, key), data);
  assert.throws(() => c.open(wire, random(32)));
});
test('safety number is 60 digits, order invariant, changes on either key or identity', () => {
  const a = { id: 'alice', key: c.b64(alice.publicKey) }, b = { id: 'bob', key: c.b64(bob.publicKey) };
  const number = c.safetyNumber(a, b);
  assert.match(number, /^(\d{5} ){11}\d{5}$/); assert.equal(number, c.safetyNumber(b, a));
  assert.notEqual(number, c.safetyNumber(a, { ...b, key: c.b64(c.keyPair(random).publicKey) }));
  assert.notEqual(number, c.safetyNumber(a, { ...b, id: 'mallory' }));
});
test('chunked scrypt matches Node known answer; backup restores and wrong passphrase fails', async () => {
  const salt = random(32), passphrase = 'six random recovery words should go here';
  let ticks = 0; const timer = setInterval(() => ticks++, 1);
  const key = await c.passphraseKey(passphrase, c.b64(salt)); clearInterval(timer);
  assert.deepEqual(Buffer.from(key), scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }));
  assert(ticks > 0, 'scrypt must yield to the event loop');
  const backup = c.seal(alice.secretKey, key, random);
  assert.deepEqual(c.open(backup, key), alice.secretKey);
  const wrong = await c.passphraseKey('a different and long recovery phrase', c.b64(salt));
  assert.throws(() => c.open(backup, wrong));
  await assert.rejects(c.passphraseKey('short', c.b64(salt)));
});

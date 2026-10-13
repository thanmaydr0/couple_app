const test = require('node:test'); const assert = require('node:assert/strict');
const ts = require('typescript'); const vm = require('node:vm'); const fs = require('node:fs'); const path = require('node:path');
const { randomBytes } = require('node:crypto'); const nacl = require('tweetnacl');
const b64 = value => Buffer.from(value).toString('base64');
const alice = nacl.box.keyPair(), bob = nacl.box.keyPair(), mallory = nacl.box.keyPair();
const storage = new Map([['us.e2ee.key.v1.alice', JSON.stringify({ secret: b64(alice.secretKey), public: b64(alice.publicKey) })]]);
let enabled = true, offline = false, peerKey = b64(bob.publicKey);
const modules = new Map();
const database = { from(table) {
  const query = { select() { return query; }, eq() { return query; }, single() { return query; },
    then(resolve, reject) { return Promise.resolve(offline ? { data: null, error: new Error('Offline') } : { data: table === 'couples' ? { e2ee_enabled: enabled } : [{ user_id: 'alice', public_key: b64(alice.publicKey) }, { user_id: 'bob', public_key: peerKey }], error: null }).then(resolve, reject); } };
  return query;
} };
function load(file) {
  file = path.resolve(file); if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const resolve = id => {
    if (id === '@/lib/supabase') return { supabase: database };
    if (id === 'expo-crypto') return { getRandomBytes: n => new Uint8Array(randomBytes(n)) };
    if (id === 'expo-secure-store') return { getItemAsync: async key => storage.get(key) ?? null, setItemAsync: async (key, value) => storage.set(key, value), deleteItemAsync: async key => storage.delete(key) };
    if (id === '@/features/e2ee/files') return { rememberFile() {}, encryptFile: async (_uri, filePath, mime) => ({ ciphertext: randomBytes(24), file: { path: filePath, mime, key: b64(randomBytes(32)), nonce: b64(randomBytes(24)) } }) };
    if (id.startsWith('@/')) return load(path.join(__dirname, '../../', id.slice(2)) + '.ts');
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id) + '.ts');
    return require(id);
  };
  vm.runInNewContext(code, { exports: module.exports, module, require: resolve, Uint8Array, URL, setTimeout, fetch, AbortSignal }); return module.exports;
}
const runtime = load(`${__dirname}/runtime.ts`), body = load(`${__dirname}/../chat/body.ts`), c = load(`${__dirname}/crypto.ts`);
const message = { id: 'id', client_id: 'client', couple_id: 'couple', sender_id: 'alice', kind: 'text', body: 'private ❤️', meta: null, media_path: null, reply_to: null, status: 'sending' };
test('wire boundary, fail-closed rollout and key pinning', async t => {
  runtime.startCrypto('alice', 'couple'); await runtime.refreshCrypto();
  await t.test('encrypted row contains no body/meta; projection restores local plaintext', async () => {
    const wire = await body.prepareMessage(message);
    assert.equal(wire.body, null); assert.equal(wire.meta, null); assert(!JSON.stringify(wire.enc).includes('private'));
    const projected = body.projectMessage({ ...message, ...wire }); assert.equal(projected.body, message.body);
    const receiver = c.decrypt(wire.enc, { couple: 'couple', author: 'alice', client: 'client', kind: 'text' }, bob.secretKey); assert.equal(receiver.body, message.body);
  });
  await t.test('encrypted voice wraps waveform and file key inside ciphertext', async () => {
    const voice = { ...message, body: null, kind: 'voice', media_path: 'couple/chat/voice/a.m4a', localUri: 'local', meta: { duration_ms: 1000, peaks: Array(64).fill(0.2) } };
    const wire = await body.prepareMessage(voice); assert(wire.encryptedFile); assert.equal(wire.meta, null);
    const clear = c.decrypt(wire.enc, { couple: 'couple', author: 'alice', client: 'client', kind: 'voice' }, bob.secretKey);
    assert.equal(clear.meta.peaks.length, 64); assert.equal(clear.file.path, voice.media_path); assert(clear.file.key);
  });
  await t.test('offline refresh refuses a send rather than falling back to plaintext', async () => {
    offline = true; await assert.rejects(body.prepareMessage(message)); offline = false; await runtime.refreshCrypto();
  });
  await t.test('unknown envelope sender key is rejected even if the directory is unchanged', () => {
    const forged = c.encrypt('forged', { couple: 'couple', author: 'bob', client: 'forged', kind: 'text' }, mallory.secretKey, b64(alice.publicKey), n => new Uint8Array(randomBytes(n)));
    assert.throws(() => runtime.decryptValue(forged, { couple: 'couple', author: 'bob', client: 'forged', kind: 'text' }));
  });
  await t.test('changed partner key blocks sending until acknowledged', async () => {
    peerKey = b64(mallory.publicKey); await runtime.refreshCrypto(); assert.equal(runtime.snapshot().changed, true);
    await assert.rejects(body.prepareMessage(message)); await runtime.acknowledgeKey(); assert.equal(runtime.snapshot().changed, false);
    assert((await body.prepareMessage(message)).enc);
  });
  await t.test('turning off retains ability to decrypt earlier ciphertext', async () => {
    const wire = await body.prepareMessage(message); enabled = false; await runtime.refreshCrypto();
    assert.equal(body.projectMessage({ ...message, ...wire }).body, message.body);
    assert.equal((await body.prepareMessage(message)).body, message.body);
  });
  await t.test('local cache uses a domain-separated key, not the X25519 secret directly', () => {
    const cacheKey = runtime.localCacheKey();
    assert.equal(cacheKey.length, 32);
    assert.notEqual(b64(cacheKey), b64(alice.secretKey));
  });
});

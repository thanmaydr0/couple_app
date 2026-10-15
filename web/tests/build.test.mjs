import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { build, root } from '../scripts/build.mjs';
const require = createRequire(import.meta.url);
await build();
test('built imports resolve locally without a CDN or native modules', async () => {
  for (const folder of ['src', 'shared']) for (const name of await readdir(resolve(root, 'dist', folder))) {
    const file = resolve(root, 'dist', folder, name); const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
      assert(match[1].startsWith('.'), `Unexpected external import: ${match[1]}`);
      await readFile(resolve(dirname(file), match[1]));
    }
    assert(!/react-native|expo-|service_role|sb_secret_/.test(source));
  }
});
test('browser encryption matches the Android protocol and rejects a changed context', async () => {
  globalThis.nacl = require('tweetnacl'); globalThis.nacl.util = require('tweetnacl-util'); globalThis.scrypt = require('scrypt-js');
  const crypto = await import('../dist/shared/crypto.js');
  const random = n => new Uint8Array(randomBytes(n)); const a = crypto.keyPair(random); const b = crypto.keyPair(random);
  const context = { couple: 'couple', author: 'alice', client: 'message', kind: 'text' };
  const value = { body: 'Our movie starts soon', meta: null, reply: null, path: null };
  const wire = crypto.encrypt(value, context, a.secretKey, crypto.b64(b.publicKey), random);
  assert.deepEqual(crypto.decrypt(wire, context, b.secretKey), value);
  assert.deepEqual(crypto.decrypt(wire, context, a.secretKey), value);
  assert.throws(() => crypto.decrypt(wire, { ...context, couple: 'another-couple' }, b.secretKey));
  const recoveryKey = random(32); const backup = crypto.seal(crypto.utf8(JSON.stringify({ secret: crypto.b64(a.secretKey), public: crypto.b64(a.publicKey) })), recoveryKey, random);
  assert.equal(JSON.parse(crypto.text(crypto.open(backup, recoveryKey))).secret, crypto.b64(a.secretKey));
  assert.throws(() => crypto.open(backup, random(32)));
});
test('production output does not include the test backend', async () => {
  const html = await readFile(resolve(root, 'dist/index.html'), 'utf8'); assert(!html.includes('qa-backend'));
  const source = await readFile(resolve(root, 'dist/config.js'), 'utf8'); const config = JSON.parse(source.match(/= (.*);/)[1]);
  assert.deepEqual(Object.keys(config).sort(), ['anonKey', 'url']);
});
test('same Android movie synchronization passes transport simulation', async () => {
  await import('../../src/features/movie/verify.mjs');
});

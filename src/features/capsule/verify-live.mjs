// Uses existing ignored credentials; never logs passwords, sessions or tokens.
// Fixtures that have unlocked require service-side cleanup; IDs are printed.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const root = new URL('../../../', import.meta.url);
const env = Object.fromEntries(readFileSync(new URL('supabase/deployment/client.env', root), 'utf8').trim().split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
const credentials = JSON.parse(readFileSync(new URL('supabase/.private/account-credentials.json', root), 'utf8'));
const clients = [0, 1].map(() => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
function check(result) { if (result.error) throw new Error(`Backend check failed: ${result.error.code ?? result.error.name}`); return result.data; }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixtures = [];
try {
  const accounts = Array.isArray(credentials) ? credentials : credentials.accounts;
  assert(Array.isArray(accounts), 'Expected account fixture list');
  for (let i = 0; i < 2; i++) check(await clients[i].auth.signInWithPassword(accounts[i]));
  const author = check(await clients[0].auth.getUser()).user.id;
  const couple = check(await clients[0].from('profiles').select('couple_id').eq('id', author).single()).couple_id;
  const server = new Date(check(await clients[0].rpc('capsule_clock'))).getTime();
  const id = randomUUID(); fixtures.push(id);
  check(await clients[0].from('capsules').insert({ id, couple_id: couple, author_id: author, title: 'Private test title', body: 'SEALED_SECRET', unlock_at: new Date(server + 120_000).toISOString(), open_together: true }));
  assert.equal(check(await clients[0].from('capsules').select('*').eq('id', id).single()).body, 'SEALED_SECRET');
  assert.equal(check(await clients[1].from('capsules').select('*').eq('id', id)).length, 0);
  const stub = check(await clients[1].rpc('capsule_stubs')).find(row => row.id === id);
  assert.equal(stub.title_hint, null); assert.equal(stub.ready, false);
  for (const key of ['body', 'media_paths', 'voice_path', 'couple_id']) assert(!(key in stub));
  assert((await clients[1].rpc('capsule_hold', { capsule: id, holding: true })).error);
  assert((await clients[1].from('capsules').update({ unlock_at: new Date().toISOString() }).eq('id', id).select()).data?.length === 0);
  assert((await clients[0].from('capsules').update({ ceremony_started_at: new Date().toISOString() }).eq('id', id)).error);
  const photo = `${couple}/capsules/${id}/test.jpg`;
  check(await clients[0].storage.from('capsules').upload(photo, Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==', 'base64'), { contentType: 'image/jpeg' }));
  check(await clients[0].from('capsules').update({ media_paths: [photo] }).eq('id', id));
  assert((await clients[1].storage.from('capsules').createSignedUrl(photo, 60)).error);
  assert((await clients[1].storage.from('capsules').download(photo)).error);
  assert.equal(check(await clients[1].storage.from('capsules').list(`${couple}/capsules/${id}`)).length, 0);
  check(await clients[0].storage.from('capsules').remove([photo]));
  check(await clients[0].from('capsules').update({ media_paths: [], unlock_at: new Date(new Date(check(await clients[0].rpc('capsule_clock'))).getTime() + 2500).toISOString() }).eq('id', id));
  const jobs = check(await clients[0].from('scheduled_jobs').select('status,payload').eq('kind', 'capsule_unlock').contains('payload', { capsule_id: id }));
  assert.equal(jobs.filter(job => job.status === 'pending').length, 1);
  assert.equal(jobs.filter(job => job.status === 'cancelled').length, 1);
  console.log('PASS sealed row, title, photo signing/download/list, spoofed ceremony, early hold, job rescheduling');
  await pause(3000);
  assert.equal(check(await clients[1].from('capsules').select('*').eq('id', id)).length, 0, 'Together content remains sealed after time');
  assert.equal(check(await clients[0].rpc('capsule_hold', { capsule: id, holding: true })), false);
  await pause(1100);
  assert.equal(check(await clients[0].rpc('capsule_hold', { capsule: id, holding: true })), false, 'One user cannot open together');
  assert.equal(check(await clients[1].rpc('capsule_hold', { capsule: id, holding: true })), false);
  await pause(1100);
  check(await clients[0].rpc('capsule_hold', { capsule: id, holding: true }));
  assert.equal(check(await clients[1].rpc('capsule_hold', { capsule: id, holding: true })), true);
  assert.equal(check(await clients[1].from('capsules').select('*').eq('id', id).single()).body, 'SEALED_SECRET');
  assert.equal(check(await clients[0].from('capsules').update({ body: 'tampered' }).eq('id', id).select()).length, 0);
  assert.equal(check(await clients[0].from('capsules').delete().eq('id', id).select()).length, 0);
  console.log('PASS server time, two distinct overlapping holds, unlocked partner read, immutable after unlock');
  const deleted = randomUUID(); fixtures.push(deleted);
  check(await clients[0].from('capsules').insert({ id: deleted, couple_id: couple, author_id: author, title: 'Delete test', unlock_at: new Date(Date.now() + 120_000).toISOString() }));
  check(await clients[0].from('capsules').delete().eq('id', deleted));
  assert.equal(check(await clients[0].from('scheduled_jobs').select('status').contains('payload', { capsule_id: deleted }).single()).status, 'cancelled');
  console.log('PASS delete cancels its pending unlock job');
} finally {
  for (const client of clients) await client.auth.signOut();
  console.log('Cleanup capsule IDs:', fixtures.join(','));
}

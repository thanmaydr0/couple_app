// Live smoke check. Reads ignored local credentials; never prints credentials.
// Run: node src/lib/verify-shell.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../../', import.meta.url);
const env = Object.fromEntries(readFileSync(new URL('supabase/deployment/client.env', root), 'utf8').trim().split(/\r?\n/).map((line) => line.split(/=(.*)/s).slice(0, 2)));
const credentials = JSON.parse(readFileSync(new URL('supabase/.private/account-credentials.json', root), 'utf8'));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const stores = [new Map(), new Map()];
const makeClient = (index) => createClient(url, key, { auth: {
  autoRefreshToken: false, persistSession: true, detectSessionInUrl: false,
  storage: { getItem: (name) => stores[index].get(name) ?? null, setItem: (name, value) => stores[index].set(name, value), removeItem: (name) => stores[index].delete(name) },
} });
const clients = [makeClient(0), makeClient(1)];
const channels = [];
function check(result) { if (result.error) throw new Error(`Backend check failed: ${result.error.code ?? result.error.name}`); return result.data; }
async function waitFor(predicate, label, timeout = 20_000) {
  const end = Date.now() + timeout;
  while (!predicate()) { assert(Date.now() < end, `${label} timed out`); await new Promise((resolve) => setTimeout(resolve, 100)); }
}
async function subscribe(channel) {
  channels.push(channel);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Subscription timed out')), 20_000);
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error(`Subscription ${status}: ${error?.message ?? 'No detail'}`)); }
    });
  });
}
try {
  const profiles = [];
  for (let index = 0; index < 2; index++) {
    const account = credentials.accounts[index];
    const { session } = check(await clients[index].auth.signInWithPassword({ email: account.email, password: account.password }));
    assert(session);
    const restored = makeClient(index);
    assert.equal(check(await restored.auth.getSession()).session.user.id, session.user.id);
    restored.auth.stopAutoRefresh();
    const profile = check(await clients[index].from('profiles').select('*').eq('id', session.user.id).single());
    assert(profile.couple_id);
    profiles.push(profile);
    const partner = check(await clients[index].from('profiles').select('*').eq('couple_id', profile.couple_id).neq('id', profile.id).single());
    assert.notEqual(partner.id, profile.id);
    check(await clients[index].from('profiles').update({ display_name: profile.display_name }).eq('id', profile.id).select('id').single());
  }
  assert.equal(profiles[0].couple_id, profiles[1].couple_id);
  console.log('PASS: both accounts sign in, restore sessions, load their partner, and save their name.');
  const coupleId = profiles[0].couple_id;
  const couple = check(await clients[0].from('couples').select('*').eq('id', coupleId).single());
  try {
    check(await clients[0].from('couples').update({ anniversary: '2024-02-14' }).eq('id', coupleId).select('id').single());
    assert.equal(check(await clients[1].from('couples').select('anniversary').eq('id', coupleId).single()).anniversary, '2024-02-14');
    const foreignRows = check(await clients[0].from('couples').update({ anniversary: null }).eq('id', '00000000-0000-0000-0000-000000000001').select('id'));
    assert.equal(foreignRows.length, 0);
    const forbidden = await clients[0].from('couples').update({ created_at: new Date().toISOString() }).eq('id', coupleId);
    assert(forbidden.error, 'Other couple columns must remain protected');
  } finally { check(await clients[0].from('couples').update({ anniversary: couple.anniversary }).eq('id', coupleId)); }
  console.log('PASS: anniversary changes reach the partner, are restored, and other rows/columns stay protected.');
  const path = `${coupleId}/avatars/${profiles[0].id}-shell-check.jpg`;
  // Tiny JPEG fixture is enough to check private Storage upload/replace/sign/delete.
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  try {
    check(await clients[0].storage.from('media').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true }));
    check(await clients[0].storage.from('media').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true }));
    const signed = check(await clients[1].storage.from('media').createSignedUrl(path, 60));
    assert((await fetch(signed.signedUrl)).ok);
  } finally { check(await clients[0].storage.from('media').remove([path])); }
  console.log('PASS: private avatar Storage supports upload, replacement and partner signed URLs; fixture deleted.');
  let profileUpdates = 0;
  const rooms = clients.map((client, index) => client.channel(`presence:${coupleId}`, { config: { private: true, presence: { key: profiles[index].id } } })
    .on('presence', { event: 'sync' }, () => {})
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `couple_id=eq.${coupleId}` }, () => { profileUpdates++; }));
  await Promise.all(rooms.map(subscribe));
  const tracking = await Promise.all(rooms.map((room, index) => room.track({ user_id: profiles[index].id })));
  assert(tracking.every((status) => status === 'ok'), `Presence tracking failed: ${tracking.join(', ')}`);
  await waitFor(() => rooms.every((room) => profiles.every((profile) => room.presenceState()[profile.id]?.length > 0)), 'Partner presence');
  console.log('PASS: combined presence/profile channels track both partners.');
  try {
    check(await clients[0].from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', profiles[0].id).select('id').single());
    await waitFor(() => profileUpdates > 0, 'Profile realtime update');
  } finally { check(await clients[0].from('profiles').update({ last_seen: profiles[0].last_seen }).eq('id', profiles[0].id)); }
  console.log('PASS: last_seen writes trigger the profile realtime subscription; original timestamp restored.');
  assert.equal(await rooms[1].untrack(), 'ok');
  await waitFor(() => !rooms[0].presenceState()[profiles[1].id]?.length, 'Partner departure');
  console.log('PASS: both private presence clients see each other; untracking removes partner online state.');
  const forbidden = clients[0].channel('presence:00000000-0000-0000-0000-000000000001', { config: { private: true, presence: { key: profiles[0].id } } }).on('presence', { event: 'sync' }, () => {});
  await assert.rejects(subscribe(forbidden), /permissions|unauthorized|not authorized/i);
  console.log('PASS: joining another couple’s private presence channel is denied.');
  for (const client of clients) check(await client.auth.signOut({ scope: 'local' }));
  for (let index = 0; index < clients.length; index++) assert.equal(check(await makeClient(index).auth.getSession()).session, null);
  console.log('PASS: sign out clears persisted sessions.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Smoke check failed');
  process.exitCode = 1;
} finally { await Promise.all(clients.map((client) => client.removeAllChannels())); }

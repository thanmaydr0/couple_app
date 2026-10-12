// Authenticated backend smoke check. Does not print secrets or touch movie files.
// Creates one test watch_sessions row and deletes ONLY that row in finally.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const root = new URL('../../../', import.meta.url);
const env = Object.fromEntries(readFileSync(new URL('supabase/deployment/client.env', root), 'utf8').trim().split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
const credentials = JSON.parse(readFileSync(new URL('supabase/.private/account-credentials.json', root), 'utf8'));
const makeClient = () => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const clients = [makeClient(), makeClient()]; const anonymous = makeClient();
const channels = []; let row;
function check(result) { if (result.error) throw new Error(`Watch backend check failed: ${result.error.code ?? result.error.name}`); return result.data; }
async function waitFor(predicate, label) {
  const end = Date.now() + 15000;
  while (!predicate()) { assert(Date.now() < end, `${label} timed out`); await new Promise(resolve => setTimeout(resolve, 50)); }
}
async function subscribe(channel, expectDenied = false) {
  channels.push(channel);
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Subscription timed out')), 15000);
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') { clearTimeout(timer); expectDenied ? reject(new Error('Forbidden channel was authorized')) : resolve(); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); expectDenied ? resolve() : reject(new Error(`Subscription ${status}`)); }
    });
  });
}
try {
  const profiles = [];
  for (let i = 0; i < 2; i++) {
    const account = credentials.accounts[i];
    const { session } = check(await clients[i].auth.signInWithPassword({ email: account.email, password: account.password }));
    profiles.push(check(await clients[i].from('profiles').select('id,couple_id').eq('id', session.user.id).single()));
    await clients[i].realtime.setAuth(session.access_token);
  }
  assert(profiles[0].couple_id && profiles[0].couple_id === profiles[1].couple_id);
  row = check(await clients[0].from('watch_sessions').insert({ couple_id: profiles[0].couple_id, host_id: profiles[0].id, title: `Watch protocol verification ${randomUUID()}`, file_size: 123456, duration_ms: 123000 }).select().single());
  const joined = check(await clients[1].from('watch_sessions').select('*').eq('id', row.id).single());
  assert.equal(joined.file_size, 123456); assert.equal(joined.duration_ms, 123000);
  check(await clients[1].from('watch_sessions').update({ status: 'active' }).eq('id', row.id));
  const events = ['play', 'pause', 'seek', 'ready', 'heartbeat', 'end', 'ping', 'pong', 'reaction', 'leave'];
  const received = [[], []];
  const pair = clients.map((client, index) => client.channel(`watch:${row.id}`, { config: { private: true, broadcast: { ack: true, self: false } } })
    .on('broadcast', { event: '*' }, ({ event, payload }) => { received[index].push({ event, payload }); }));
  await subscribe(pair[0]); await subscribe(pair[1]);
  for (let i = 0; i < 2; i++) for (const event of events) {
    assert.equal(await pair[i].send({ type: 'broadcast', event, payload: { sender: profiles[i].id, pos: 12.345, playing: true, sentAt: Date.now(), emoji: '❤️' } }), 'ok');
  }
  await waitFor(() => received.every(list => list.length === events.length), 'bidirectional events');
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(received[i].map(p => p.event), events);
    assert(received[i].every(p => p.payload.sender === profiles[1 - i].id && p.payload.pos === 12.345));
  }
  console.log('PASS both accounts create/read/join a session; all ten private events deliver in both directions without self echoes');
  await subscribe(clients[0].channel(`watch:${randomUUID()}`, { config: { private: true } }), true);
  await subscribe(anonymous.channel(`watch:${row.id}`, { config: { private: true } }), true);
  const unauthenticated = await anonymous.from('watch_sessions').select('id').eq('id', row.id);
  assert(unauthenticated.error || unauthenticated.data?.length === 0);
  const foreignUpdate = check(await clients[1].from('watch_sessions').update({ status: 'ended' }).eq('id', randomUUID()).select('id'));
  assert.equal(foreignUpdate.length, 0);
  console.log('PASS unknown session channels and anonymous subscriptions/reads are rejected');
  const ends = [];
  const changes = clients[1].channel(`watch-verify:${randomUUID()}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'watch_sessions', filter: `id=eq.${row.id}` }, payload => ends.push(payload.new.status));
  await subscribe(changes);
  check(await clients[0].from('watch_sessions').update({ status: 'ended' }).eq('id', row.id));
  await waitFor(() => ends.includes('ended'), 'session end update');
  console.log('PASS session end is persisted and reaches partner through Postgres Changes');
} finally {
  if (row) check(await clients[0].from('watch_sessions').delete().eq('id', row.id));
  await Promise.all([...clients, anonymous].map(client => client.removeAllChannels()));
  clients.forEach(client => client.auth.stopAutoRefresh());
}

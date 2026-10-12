/* Run from repo root: node src/features/calls/live-check.cjs
 * Uses existing local test accounts. Never prints passwords, JWTs, TURN
 * credentials, or tokens. Cleans up only the history rows it creates.
 */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('node:crypto');
const env = Object.fromEntries(fs.readFileSync('supabase/deployment/client.env', 'utf8').split(/\r?\n/)
  .filter((line) => line.includes('=')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')]; }));
const accounts = JSON.parse(fs.readFileSync('supabase/.private/account-credentials.json', 'utf8')).accounts;
const clients = accounts.map(() => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
const channels = [];
const rows = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function join(channel) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Realtime subscription timed out')), 15000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) { clearTimeout(timer); reject(new Error(`Realtime subscription: ${status}`)); }
    });
  });
}
async function main() {
  assert.equal(clients.length, 2);
  const users = [];
  let coupleId;
  for (let i = 0; i < clients.length; i++) {
    const { data, error } = await clients[i].auth.signInWithPassword({ email: accounts[i].email, password: accounts[i].password });
    assert.ifError(error); users.push(data.user.id);
    const profile = await clients[i].from('profiles').select('couple_id').eq('id', data.user.id).single();
    assert.ifError(profile.error);
    if (coupleId) assert.equal(profile.data.couple_id, coupleId);
    coupleId = profile.data.couple_id;
    const turn = await clients[i].functions.invoke('turn-credentials', { body: {} });
    assert.ifError(turn.error); assert(Array.isArray(turn.data));
    const relayCount = turn.data.filter((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/.test(u))).length;
    assert(relayCount > 0, 'TURN returned STUN only');
    console.log(`Account ${i + 1}: paired profile and TURN passed (${relayCount} relay servers)`);
  }
  const received = [[], []];
  for (let i = 0; i < clients.length; i++) {
    const channel = clients[i].channel(`call:${coupleId}`, { config: { private: true, broadcast: { ack: true, self: false } } });
    channel.on('broadcast', { event: '*' }, (message) => received[i].push(message));
    channels.push(channel); await join(channel);
  }
  const id = randomUUID();
  for (const event of ['invite', 'accept', 'decline', 'cancel', 'offer', 'answer', 'ice', 'end', 'busy']) {
    const payload = { id, from: users[0], to: users[1], coupleId, kind: 'audio', sentAt: Date.now() };
    assert.equal(await channels[0].send({ type: 'broadcast', event, payload }), 'ok');
  }
  assert.equal(await channels[1].send({ type: 'broadcast', event: 'accept', payload: { id, from: users[1], to: users[0], coupleId, kind: 'audio', sentAt: Date.now() } }), 'ok');
  for (let retry = 0; retry < 30 && (received[1].length < 9 || received[0].length < 1); retry++) await delay(100);
  assert.equal(received[1].filter((m) => m.payload.id === id).length, 9);
  assert.equal(received[0].filter((m) => m.payload.id === id).length, 1);
  console.log('Private broadcast: all 9 events delivered; reverse delivery passed; self delivery disabled');
  const foreign = clients[0].channel(`call:${randomUUID()}`, { config: { private: true } });
  channels.push(foreign);
  await assert.rejects(join(foreign));
  console.log('Foreign couple channel: subscription denied');
  for (const status of ['answered', 'declined', 'missed', 'ended']) {
    const callId = randomUUID();
    const insert = await clients[0].from('calls').insert({ id: callId, couple_id: coupleId, caller_id: users[0], kind: 'audio', status: 'ringing' }).select().single();
    assert.ifError(insert.error); rows.push(callId);
    const patch = { status, ...(status === 'answered' ? { answered_at: new Date().toISOString() } : { ended_at: new Date().toISOString() }) };
    const update = await clients[1].from('calls').update(patch).eq('id', callId).eq('couple_id', coupleId).eq('status', 'ringing').select().single();
    assert.ifError(update.error); assert.equal(update.data.status, status);
    if (status === 'answered') {
      const end = await clients[0].from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callId).eq('status', 'answered').select().single();
      assert.ifError(end.error); assert.equal(end.data.status, 'ended');
    }
    const revive = await clients[0].from('calls').update({ status: 'answered' }).eq('id', callId).eq('status', 'ringing').select();
    assert.ifError(revive.error); assert.equal(revive.data.length, 0);
  }
  console.log('History: ringing → answered → ended, declined, missed, ended; terminal rows cannot revive through guarded updates');
  const forbidden = await clients[0].from('calls').insert({ couple_id: randomUUID(), caller_id: users[0], kind: 'audio' });
  assert(forbidden.error, 'Cross-couple insert should be rejected');
  console.log('History: cross-couple write denied');
  // A terminal test ID ensures a device cannot recover a live incoming screen.
  const push = await clients[0].functions.invoke('notify-partner', { body: {
    type: 'call', title: 'Call setup checked', body: 'Calling setup verification completed.',
    data: { type: 'call', callId: rows[0], coupleId, startedAt: new Date(Date.now() - 60000).toISOString(), url: '/call' },
  }});
  assert.ifError(push.error); assert.equal(push.data.ok, true);
  console.log('notify-partner type call: function accepted (device delivery requires a registered token)');
}
main().catch((error) => { console.error('Call backend check failed:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; }).finally(async () => {
  for (const client of clients) await client.removeAllChannels();
  if (rows.length) {
    const cleanup = await clients[0].from('calls').delete().in('id', rows);
    if (cleanup.error) { console.error('Test-row cleanup failed. IDs:', rows.join(', ')); process.exitCode = 1; }
    else console.log('Temporary call-history rows removed');
  }
});

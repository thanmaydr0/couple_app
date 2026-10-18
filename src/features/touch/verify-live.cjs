// Uses the existing ignored paired-account fixture. Never logs credentials or sends notifications.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync('supabase/deployment/client.env', 'utf8').trim().split(/\r?\n/).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')]; }));
const accounts = JSON.parse(fs.readFileSync('supabase/.private/account-credentials.json', 'utf8')).accounts;
const clients = accounts.map(() => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
const channels = [];
const wait = async predicate => { const end = Date.now() + 15000; while (!predicate()) { assert(Date.now() < end, 'Realtime delivery timed out'); await new Promise(resolve => setTimeout(resolve, 50)); } };
const join = channel => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Realtime join timed out')), 15000);
  channel.subscribe(status => {
    if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
    else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) { clearTimeout(timer); reject(new Error(`Realtime ${status}`)); }
  });
});
(async () => {
  try {
    const profiles = [];
    for (const [i, client] of clients.entries()) {
      const login = await client.auth.signInWithPassword(accounts[i]); assert.ifError(login.error);
      const profile = await client.from('profiles').select('id,couple_id').eq('id', login.data.user.id).single(); assert.ifError(profile.error); profiles.push(profile.data);
    }
    assert.equal(profiles[0].couple_id, profiles[1].couple_id);
    const received = [[], []];
    for (const [i, client] of clients.entries()) {
      const channel = client.channel(`touch:${profiles[i].couple_id}`, { config: { private: true, broadcast: { ack: true, self: false }, presence: { key: `release-check-${i}` } } });
      channel.on('presence', { event: 'sync' }, () => {}).on('broadcast', { event: 'signal' }, ({ payload }) => received[i].push(payload));
      channels.push(channel); await join(channel);
      assert.equal(await channel.track({ user: profiles[i].id, instance: `release-check-${i}`, accent: '#123456' }), 'ok');
    }
    await wait(() => channels.slice(0, 2).every(c => Object.values(c.presenceState()).flat().length >= 2));
    for (const [i, channel] of channels.entries()) {
      for (const [seq, kind] of ['ready', 'touch', 'up'].entries()) {
        assert.equal(await channel.send({ type: 'broadcast', event: 'signal', payload: { kind, user: profiles[i].id, instance: `release-check-${i}`, seq, at: Date.now(), ...(kind === 'touch' ? { down: true, point: { x: .5, y: .5 } } : {}) } }), 'ok');
      }
    }
    await wait(() => received.every(messages => messages.length >= 3));
    assert(received.every((messages, i) => messages.every(message => message.user === profiles[1 - i].id)));
    console.log('PASS: both paired accounts join private Touch, publish presence, and exchange ready/touch/release in both directions.');
    const foreign = clients[0].channel(`touch:${randomUUID()}`, { config: { private: true } }); channels.push(foreign);
    await assert.rejects(join(foreign));
    console.log('PASS: unrelated couple topic denied.');
  } finally {
    await Promise.all(channels.map(channel => channel.unsubscribe()));
    await Promise.all(clients.map(async client => { await client.removeAllChannels(); await client.auth.signOut({ scope: 'local' }); }));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

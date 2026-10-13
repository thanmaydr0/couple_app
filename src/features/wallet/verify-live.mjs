// Uses ignored deployment credentials; never prints passwords, keys or sessions.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const root = new URL('../../../', import.meta.url);
const env = Object.fromEntries(readFileSync(new URL('supabase/deployment/client.env', root), 'utf8').trim().split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
const stored = JSON.parse(readFileSync(new URL('supabase/.private/account-credentials.json', root), 'utf8'));
const accounts = Array.isArray(stored) ? stored : stored.accounts;
const clients = [0, 1, 2].map(() => createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
function check(result) { if (result.error) throw new Error(`Wallet API check failed: ${result.error.code ?? result.error.name}`); return result.data; }
let path;
try {
 for (let i = 0; i < 2; i++) check(await clients[i].auth.signInWithPassword(accounts[i]));
 const user = check(await clients[0].auth.getUser()).user.id;
 const couple = check(await clients[0].from('profiles').select('couple_id').eq('id', user).single()).couple_id;
 for (const table of ['wallet_expenses', 'wallet_settlements', 'wallet_goals', 'wallet_contributions', 'wallet_recurring']) {
  for (const client of clients.slice(0, 2)) check(await client.from(table).select('*').eq('couple_id', couple).limit(1));
  const anonymous = await clients[2].from(table).select('*').limit(1);
  assert(anonymous.error || anonymous.data.length === 0, 'Anonymous ledger access denied');
 }
 path = `${couple}/receipts/${randomUUID()}/wallet-verification.jpg`;
 const bytes = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==', 'base64');
 check(await clients[0].storage.from('wallet-receipts').upload(path, bytes, { contentType: 'image/jpeg' }));
 check(await clients[1].storage.from('wallet-receipts').createSignedUrl(path, 60));
 assert((await clients[2].storage.from('wallet-receipts').createSignedUrl(path, 60)).error, 'Anonymous receipt signing denied');
 assert((await clients[0].storage.from('wallet-receipts').upload(`${randomUUID()}/receipts/spoof.jpg`, bytes, { contentType: 'image/jpeg' })).error, 'Cross-couple receipt upload denied');
 console.log('PASS: both account API access, anonymous ledger denial, private receipt upload, partner signing, anonymous signing denial, cross-couple upload rejection');
} finally {
 if (path) check(await clients[0].storage.from('wallet-receipts').remove([path]));
 for (const client of clients) await client.auth.signOut({ scope: 'local' });
 console.log('Wallet receipt fixture removed; sessions signed out.');
}

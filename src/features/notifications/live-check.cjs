// Reads ignored local credentials; never prints passwords, JWTs or push tokens.
// Sends one real test notification to each account's OWN registered phone.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const env = Object.fromEntries(fs.readFileSync('supabase/deployment/client.env', 'utf8').trim().split(/\r?\n/).map((line) => {
    const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)];
  }));
  const accounts = JSON.parse(fs.readFileSync('supabase/.private/account-credentials.json', 'utf8')).accounts;
  for (const [index, account] of accounts.entries()) {
    const client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await client.auth.signInWithPassword({ email: account.email, password: account.password });
    assert.equal(login.error, null, 'Sign-in failed');
    const tokens = await client.from('push_tokens').select('user_id');
    assert.equal(tokens.error, null, 'Owner token query failed');
    assert(tokens.data.every((row) => row.user_id === login.data.user.id), 'Token RLS leaked another owner');
    console.log(`Account ${index + 1}: sign-in and owner-only token reads passed; registrations=${tokens.data.length}`);
    const response = await client.functions.invoke('notify-partner', { body: {
      type: 'test', title: 'Us push setup check', body: 'Checking remote delivery to your own phone.',
      data: { recipientId: 'ignored-supplied-recipient' },
    } });
    if (response.error) console.log(`Account ${index + 1}: remote test rejected (HTTP ${response.error.context?.status ?? 'unknown'}); check FCM credentials and device token.`);
    else { assert.equal(response.data.ok, true); console.log(`Account ${index + 1}: Expo accepted remote test; physical display still needs verification.`); }
    await client.auth.signOut({ scope: 'local' });
  }
  const unauth = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-partner`, {
    method: 'POST', headers: { apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(unauth.status, 401, 'Missing JWT accepted');
  console.log('Deployed function rejected missing JWT.');
}
main().catch(() => { console.error('Live verification failed; details suppressed to keep credentials private.'); process.exitCode = 1; });

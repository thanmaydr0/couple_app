import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../dist/config.js', import.meta.url), 'utf8');
const config = JSON.parse(source.match(/= (.*);/)[1]);
if (!config.url || !config.anonKey) throw new Error('Build with public Supabase settings first.');
const health = await fetch(`${config.url}/auth/v1/health`, { headers: { apikey: config.anonKey }, signal: AbortSignal.timeout(10000) });
console.log(`Supabase Auth health: HTTP ${health.status}`);
if (!health.ok) throw new Error('Supabase URL/public key could not be validated.');
for (const table of ['profiles', 'messages', 'watch_sessions']) {
  const response = await fetch(`${config.url}/rest/v1/${table}?select=id&limit=1`, { headers: { apikey: config.anonKey }, signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  const denied = [401, 403].includes(response.status) || (response.ok && Array.isArray(data) && data.length === 0);
  console.log(`${table}: HTTP ${response.status}; anonymous access ${denied ? 'denied / zero visible rows' : 'UNEXPECTED RESULT'}`);
  if (!denied) process.exitCode = 1;
}

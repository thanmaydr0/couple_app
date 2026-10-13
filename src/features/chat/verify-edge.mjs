// Disposable integration accounts are supplied by the test orchestrator. Never
// point this at the users' accounts. The orchestrator removes all fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const at = line.indexOf('='); return [line.slice(0,at),line.slice(at+1).replace(/^['"]|['"]$/g,'')]; }));
const base = env.EXPO_PUBLIC_SUPABASE_URL; const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const fixture = JSON.parse(process.env.CHAT_EDGE_FIXTURE);
const login = async email => {
  const response = await fetch(`${base}/auth/v1/token?grant_type=password`, { method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email,password:fixture.password}) });
  assert.equal(response.status,200,'Disposable account login'); return (await response.json()).access_token;
};
const author = await login(fixture.email); const receiver = await login(fixture.receiverEmail);
const headers = token => ({apikey:anon,Authorization:`Bearer ${token}`,'Content-Type':'application/json'});
const invoke = (token,body) => fetch(`${base}/functions/v1/link-preview`,{method:'POST',headers:headers(token),body:JSON.stringify(body)});
const unauthorized = await fetch(`${base}/functions/v1/link-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(unauthorized.status,401); console.log('PASS: unauthenticated requests rejected');
for(const url of ['http://127.0.0.1/','http://169.254.169.254/','http://2130706433/','http://[::ffff:127.0.0.1]/','file:///etc/passwd','http://localhost/','https://example.com:8443/']) {
  const response=await invoke(author,{url});assert.ok([400,403].includes(response.status),`Blocked URL: ${url}, status ${response.status}`);
}
console.log('PASS: local, metadata, encoded, IPv6, file and unexpected-port URLs rejected');
const previewUrl=`https://example.com/?chat-test=${fixture.message}`;
const preview=await invoke(author,{url:previewUrl});
assert.equal(preview.status,200,`Public preview failed: ${await preview.clone().text()}`);
const card=await preview.json(); assert.ok(card.title.includes('Example Domain')); assert.equal(card.url,previewUrl);
const cached=await invoke(receiver,{url:previewUrl});assert.equal(cached.status,200);const cachedCard=await cached.json();for(const field of ['url','title','description','image']) assert.deepEqual(cachedCard[field],card[field]);
console.log('PASS: public Open Graph fetch and couple cache');
const path=`${fixture.cid}/chat-once/${fixture.author}/fixture.jpg`;
// Tiny fixture bytes suffice for Storage access checks; no real photo is used.
const upload=await fetch(`${base}/storage/v1/object/chat-once/${path}`,{method:'POST',headers:{...headers(author),'Content-Type':'image/jpeg','cache-control':'0'},body:new Uint8Array([255,216,255,217])});assert.equal(upload.status,200);
const insert=await fetch(`${base}/rest/v1/messages`,{method:'POST',headers:{...headers(author),Prefer:'return=representation'},body:JSON.stringify({id:fixture.message,couple_id:fixture.cid,sender_id:fixture.author,kind:'image',client_id:fixture.message,media_path:path,view_once:true})});assert.equal(insert.status,201,await insert.text());
const bypass=await fetch(`${base}/storage/v1/object/sign/chat-once/${path}`,{method:'POST',headers:headers(receiver),body:JSON.stringify({expiresIn:60})});assert.notEqual(bypass.status,200);
assert.equal((await invoke(author,{action:'open-once',message_id:fixture.message})).status,409);
const opened=await invoke(receiver,{action:'open-once',message_id:fixture.message});assert.equal(opened.status,200,await opened.clone().text());const signed=await opened.json();
assert.equal((await fetch(signed.url)).status,200);
assert.equal((await invoke(receiver,{action:'open-once',message_id:fixture.message})).status,409);
assert.equal((await invoke(receiver,{action:'close-once',message_id:fixture.message})).status,200);
console.log('PASS: private upload, direct-sign denial, recipient-only one-time claim, signed viewer and Edge deletion');
const edited=await fetch(`${base}/rest/v1/messages?id=eq.${fixture.message}`,{method:'PATCH',headers:{...headers(author),Prefer:'return=representation'},body:JSON.stringify({deleted_at:new Date().toISOString()})});assert.equal(edited.status,200);const rows=await edited.json();assert.equal(rows[0].body,null);assert.ok(rows[0].deleted_at);
console.log('PASS: authenticated tombstone update');

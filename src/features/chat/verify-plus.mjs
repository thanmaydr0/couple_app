import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; new Function('exports','require',compiled)(exports,require); return exports;
}
const body=load('./body.ts'); const model=load('./model.ts'); const network=load('../../../supabase/functions/link-preview/safe-fetch.ts');
const row=extra=>({id:'id',client_id:'id',couple_id:'couple',sender_id:'author',kind:'text',body:'hello',media_path:null,reply_to:null,read_at:null,created_at:new Date().toISOString(),status:'sent',...extra});
test('body codec centralizes empty handling, link parsing and search escaping',()=>{
  assert.equal(body.encodeBody('  hi  '),'hi');assert.equal(body.encodeBody('  '),null);assert.equal(body.decodeBody(null),'');
  assert.equal(body.firstLink('Visit https://example.com/path.'),'https://example.com/path');assert.equal(body.firstLink('file:///secret'),null);
  assert.equal(body.searchPattern('100%_match'),'%'+'100\\%\\_match'+'%');
  assert.deepEqual(body.matchParts('Hello love','LOVE').filter(part=>part.match),[{text:'love',match:true}]);
  assert.deepEqual(body.matchRanges('hello',[[0,1],[3,4]]),[{text:'he',match:true},{text:'l',match:false},{text:'lo',match:true}]);
});
test('tombstones and expired messages cannot leak through summaries or search',()=>{
  const deleted=row({body:'secret',deleted_at:new Date().toISOString()});
  assert.equal(body.bodyText(deleted,'author','author'),'You deleted this message');assert.equal(body.searchBody(deleted),'');
  const expired=row({body:'secret',expires_at:new Date(Date.now()-1).toISOString()});
  assert.equal(body.bodySummary(expired),'Message expired');assert.equal(body.searchBody(expired),'');
});
test('late echoes cannot restore edited/deleted bodies or unopened photos',()=>{
  const deleted=row({body:null,deleted_at:new Date().toISOString()});assert.equal(model.mergeMessages([deleted],[row({})])[0].body,null);
  const edited=row({body:'new',edited_at:new Date().toISOString()});assert.equal(model.mergeMessages([edited],[row({})])[0].body,'new');
  const viewed=row({viewed_at:new Date().toISOString()});assert.equal(model.mergeMessages([viewed],[row({})])[0].viewed_at,viewed.viewed_at);
});
test('unchanged polling results retain bubble identity for memoized long histories',()=>{
  const original=row({viewed_at:null});assert.equal(model.mergeMessages([original],[{...original}])[0],original);
});
test('SSRF validation blocks normalized and reserved addresses',()=>{
  for(const ip of ['0.0.0.0','10.1.1.1','127.0.0.1','169.254.169.254','172.31.0.1','192.168.1.1','100.64.0.1','198.19.0.1','192.0.2.1','203.0.113.1','224.1.1.1','255.255.255.255','::1','::ffff:127.0.0.1'])assert.equal(network.publicIPv4(ip),false,ip);
  for(const url of ['http://2130706433','http://0177.0.0.1','http://0x7f000001','http://[::1]','http://127.0.0.1','http://localhost.','http://metadata.internal','http://example.local','https://user:pass@example.com','https://example.com:444','file:///secret'])assert.throws(()=>network.safeUrl(url),undefined,url);
  assert.equal(network.safeUrl('https://example.com/#fragment').href,'https://example.com/');assert.equal(network.publicIPv4('8.8.8.8'),true);
});
test('Open Graph parses reordered attributes, entities and bounded text',()=>{
  const parsed=network.parseOpenGraph('<title>Fallback</title><meta content="A &amp; B" property="og:title"><meta name="description" content="Description"><meta property="og:image" content="/image.jpg">');
  assert.deepEqual(parsed,{title:'A & B',description:'Description',image:'/image.jpg'});
  assert.equal(network.parseOpenGraph('<meta property="og:title" content="'+'a'.repeat(300)+'">').title.length,240);
});
test('private fetches are rejected before a connection is attempted',async()=>{
  await assert.rejects(network.safeFetch('http://169.254.169.254/'));
});
test('chunk decoder rejects malformed, truncated and oversized payloads',()=>{
  const bytes=text=>new TextEncoder().encode(text);
  assert.equal(new TextDecoder().decode(network.unchunk(bytes('5\r\nhello\r\n0\r\n\r\n'),10)),'hello');
  for(const text of ['z\r\nhello','5\r\nhi','20\r\n'+'a'.repeat(32)+'\r\n0\r\n\r\n'])assert.throws(()=>network.unchunk(bytes(text),10));
});
test('actual connection is pinned; every redirect is revalidated',async()=>{
  const previous=globalThis.Deno;let calls=0;let closed=0;
  globalThis.Deno={connect:async({hostname})=>{
    assert.equal(hostname,'8.8.8.8');calls++;let sent=false;
    return {close(){closed++;},write:async bytes=>bytes.length,read:async buffer=>{if(sent)return null;sent=true;const reply=new TextEncoder().encode('HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1/\r\nContent-Length: 0\r\n\r\n');buffer.set(reply);return reply.length;}};
  }};
  try {await assert.rejects(network.safeFetch('http://8.8.8.8/'));assert.equal(calls,1);assert.equal(closed,1);}finally{globalThis.Deno=previous;}
});

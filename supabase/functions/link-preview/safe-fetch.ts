import { resolve4 } from 'node:dns/promises';
import { isIP } from 'node:net';

export function publicIPv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split('.').map(Number);
  return a !== undefined && b !== undefined && c !== undefined && a > 0 && a < 224
    && a !== 10 && a !== 127 && !(a === 169 && b === 254)
    && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && b === 168)
    && !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && (b === 18 || b === 19))
    && !(a === 192 && (b === 0 || b === 2)) && !(a === 198 && b === 51 && c === 100)
    && !(a === 203 && b === 0 && c === 113);
}
export function safeUrl(value: string): URL {
  if (value.length > 2048) throw new Error('URL too long');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80'))) throw new Error('Unsupported URL');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // IPv6 is intentionally unsupported, including mapped IPv4 and zone IDs.
  if (host.includes(':') || host.includes('[') || !host.includes('.') || /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host) || (isIP(host) && !publicIPv4(host))) throw new Error('Local addresses are blocked');
  url.hash = '';
  if(url.href.length>2048)throw new Error('URL too long');
  return url;
}
type HttpResult = { status: number; location?: string; type: string; bytes: Uint8Array };
async function deadline<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort: () => void = () => {};
  try { return await Promise.race([work,new Promise<never>((_,reject)=>{abort=()=>reject(new Error('Timed out'));if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});})]); }
  finally {signal.removeEventListener('abort',abort);}
}
export function unchunk(bytes: Uint8Array, limit: number): Uint8Array {
  const chunks: Uint8Array[] = []; let at = 0; let size = 0;
  while (at < bytes.length) {
    let end = at; while (end+1 < bytes.length && !(bytes[end]===13 && bytes[end+1]===10)) end++;
    if (end-at>128 || end+1>=bytes.length) throw new Error('Invalid chunk header');
    const header = new TextDecoder().decode(bytes.subarray(at,end)).split(';')[0]!;
    if (!/^[0-9a-f]+$/i.test(header)) throw new Error('Invalid chunk size');
    const length = parseInt(header,16); at=end+2;
    if (length===0) { const output=new Uint8Array(size); let offset=0; for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;} return output; }
    size+=length;
    if (size>limit || at+length+2>bytes.length || bytes[at+length]!==13 || bytes[at+length+1]!==10) throw new Error('Invalid or excessive chunk');
    chunks.push(bytes.subarray(at,at+length)); at+=length+2;
  }
  throw new Error('Truncated chunked response');
}
async function pinnedRequest(url: URL, address: string, image: boolean, signal: AbortSignal): Promise<HttpResult> {
  // Supabase's Node HTTP shim does not implement custom lookup. Connect to the
  // checked IP with TCP, then start TLS against the original hostname for SNI
  // and certificate validation. Neither step resolves that hostname again.
  const tcp = await deadline(Deno.connect({ hostname: address, port: url.protocol==='https:' ? 443 : 80 }).then(connection=>{if(signal.aborted){connection.close();throw new Error('Timed out');}return connection;}),signal);
  let connection: Deno.Conn = tcp;
  const close=()=>{try{connection.close();}catch{/* already closed */}};
  const abort=()=>close(); signal.addEventListener('abort',abort,{once:true});
  try {
    signal.throwIfAborted();
    if(url.protocol==='https:') connection=await Deno.startTls(tcp,{hostname:url.hostname});
    const request=new TextEncoder().encode(`GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.host}\r\nUser-Agent: UsChatPreview/1.0\r\nAccept: ${image ? 'image/jpeg,image/png,image/webp' : 'text/html'}\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`);
    for(let at=0;at<request.length;) { signal.throwIfAborted(); at+=await connection.write(request.subarray(at)); }
    const limit=image ? 524288 : 262144; const headerLimit=16384;
    const chunks: Uint8Array[]=[]; let size=0; let headerEnd=-1; let headerText='';
    let status=0; let type=''; let contentLength: number | null=null; let chunked=false;
    for(;;) {
      signal.throwIfAborted(); const buffer=new Uint8Array(8192); const length=await connection.read(buffer); if(length===null)break;
      size+=length; if(size>limit+headerLimit+32768)throw new Error('Response too large');
      chunks.push(buffer.slice(0,length));
      if(headerEnd<0) {
        headerText+=new TextDecoder('latin1').decode(buffer.subarray(0,length));
        headerEnd=headerText.indexOf('\r\n\r\n');
        if(headerEnd<0) { if(size>headerLimit)throw new Error('Headers too large'); continue; }
        if(headerEnd>headerLimit)throw new Error('Headers too large');
        const lines=headerText.slice(0,headerEnd).split('\r\n');
        const match=lines.shift()?.match(/^HTTP\/1\.[01] ([0-9]{3}) /); if(!match)throw new Error('Invalid response'); status=Number(match[1]);
        const headers=new Map<string,string>(); for(const line of lines) { const colon=line.indexOf(':'); if(colon<=0)throw new Error('Invalid header'); const name=line.slice(0,colon).toLowerCase(); if(headers.has(name) && ['content-length','transfer-encoding'].includes(name))throw new Error('Ambiguous framing'); headers.set(name,line.slice(colon+1).trim()); }
        type=(headers.get('content-type') ?? '').split(';')[0]!.toLowerCase();
        if(status>=300 && status<400)return {status,location:headers.get('location'),type,bytes:new Uint8Array()};
        if(status!==200 || (image ? !['image/jpeg','image/png','image/webp'].includes(type) : type!=='text/html'))throw new Error('Unsupported response');
        if(headers.has('content-encoding') && headers.get('content-encoding')!=='identity')throw new Error('Compressed response refused');
        if(headers.has('content-length')) { const value=headers.get('content-length')!; if(!/^\d+$/.test(value))throw new Error('Invalid length'); contentLength=Number(value); if(contentLength>limit)throw new Error('Response too large'); }
        if(headers.has('transfer-encoding')) { if(headers.get('transfer-encoding')!=='chunked' || contentLength!==null)throw new Error('Unsupported encoding'); chunked=true; }
      }
      if(contentLength!==null && size-headerEnd-4>=contentLength)break;
    }
    if(headerEnd<0)throw new Error('Truncated response');
    const raw=new Uint8Array(size); let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}
    let bytes=raw.subarray(headerEnd+4);
    if(chunked)bytes=unchunk(bytes,limit);
    if(contentLength!==null) { if(bytes.length<contentLength)throw new Error('Truncated response'); bytes=bytes.subarray(0,contentLength); }
    if(bytes.length>limit)throw new Error('Response too large');
    return {status,type,bytes};
  } finally { signal.removeEventListener('abort',abort);close(); }
}
export async function safeFetch(value: string, image = false, signal = AbortSignal.timeout(8000)): Promise<{ url: string; type: string; bytes: Uint8Array }> {
  let url = safeUrl(value);
  for (let redirect = 0; redirect <= 3; redirect++) {
    signal.throwIfAborted();
    const addresses = isIP(url.hostname) ? [url.hostname] : await deadline(resolve4(url.hostname),signal);
    if (!addresses.length || addresses.some(ip => !publicIPv4(ip))) throw new Error('Private DNS addresses are blocked');
    const address = addresses[0]!;
    const result=await pinnedRequest(url,address,image,signal);
    if (result.status >= 300 && result.status < 400) {
      if (redirect === 3 || !result.location) throw new Error('Too many redirects');
      url = safeUrl(new URL(result.location, url).href); continue;
    }
    return { url: url.href, type: result.type, bytes: result.bytes };
  }
  throw new Error('Too many redirects');
}
const entities = (value: string) => value.replace(/&(?:amp|quot|apos|lt|gt|#39);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>' })[entity] ?? entity).replace(/<[^>]*>/g, '').trim();
export function parseOpenGraph(html: string): { title: string; description: string; image: string | null } {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]{0,8192}>/gi) ?? []) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attributes.set(match[1]!.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
    const key = attributes.get('property') ?? attributes.get('name');
    if (key && !meta.has(key)) meta.set(key, entities(attributes.get('content') ?? ''));
  }
  return { title: (meta.get('og:title') || entities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')).slice(0, 240), description: (meta.get('og:description') || meta.get('description') || '').slice(0, 500), image: meta.get('og:image') ?? null };
}

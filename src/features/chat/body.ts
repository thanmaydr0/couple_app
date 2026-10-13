// The only message-body codec. E2EE can replace these boundaries, then disable
// server search/previews and keep the local search projection after decryption.
type BodyMessage = { body: string | null; kind: string; deleted_at?: string | null; expires_at?: string | null; view_once?: boolean };
export function encodeBody(text: string): string | null { return text.trim().slice(0, 4000) || null; }
export function decodeBody(body: string | null | undefined): string { return body ?? ''; }
export function expired(message: Pick<BodyMessage, 'expires_at'>, now = Date.now()): boolean {
  return !!message.expires_at && Date.parse(message.expires_at) <= now;
}
export function bodyText(message: BodyMessage, uid?: string, sender?: string): string {
  if (message.deleted_at) return sender === uid && uid ? 'You deleted this message' : 'This message was deleted';
  if (expired(message)) return 'Message expired';
  return decodeBody(message.body);
}
export function bodySummary(message: BodyMessage): string {
  return bodyText(message) || (message.kind === 'voice' ? 'Voice message' : message.kind === 'image' ? message.view_once ? 'View-once photo' : '📷 Photo' : 'Message');
}
export function firstLink(body: string | null | undefined): string | null {
  const match = decodeBody(body).match(/https?:\/\/[^\s<>]+/i)?.[0]?.replace(/[),.!?;]+$/, '');
  if (!match) return null;
  try { const url = new URL(match); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null; } catch { return null; }
}
export function searchBody(message: BodyMessage): string { return message.deleted_at || expired(message) ? '' : decodeBody(message.body); }
export function searchPattern(text: string): string { return `%${text.trim().slice(0, 120).replace(/[\\%_]/g, '\\$&')}%`; }
export function matchParts(text: string, query: string): { text: string; match: boolean }[] {
  if (!query.trim()) return [{ text, match: false }];
  const at = text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
  if (at < 0) return [{ text, match: false }];
  return [{ text: text.slice(0, at), match: false }, { text: text.slice(at, at + query.trim().length), match: true }, { text: text.slice(at + query.trim().length), match: false }];
}
export function matchRanges(text: string, ranges: readonly (readonly [number,number])[]): {text:string;match:boolean}[] {
  const parts: {text:string;match:boolean}[]=[]; let at=0;
  for(const [start,last] of [...ranges].sort((a,b)=>a[0]-b[0])) {
    const from=Math.max(at,start); const end=Math.min(text.length,last+1);
    if(end<=from)continue;
    if(from>at)parts.push({text:text.slice(at,from),match:false});
    parts.push({text:text.slice(from,end),match:true}); at=end;
  }
  if(at<text.length)parts.push({text:text.slice(at),match:false});
  return parts.length ? parts : [{text,match:false}];
}

// The single plaintext/wire boundary for chat, including reactions and schedules.
import { decryptValue, encryptValue, encryptionRequired } from '@/features/e2ee/runtime';
import { encryptFile, rememberFile, type FileSecret } from '@/features/e2ee/files';
import type { ChatRow, LinkPreview, Reaction } from './types';
import type { ChatMessage } from './model';
import { isVoiceMeta } from '@/features/voice/types';
import { isEnvelope } from '@/features/e2ee/crypto';
type Payload = { body: string | null; meta: ChatRow['meta']; file?: FileSecret; preview?: LinkPreview | null; reply: string | null; path: string | null };
const previews = new Map<string, LinkPreview>();
export function cachedLinkPreview(url: string): LinkPreview | undefined { return previews.get(url); }
const context = (row: Pick<ChatRow, 'couple_id' | 'sender_id' | 'client_id' | 'kind'>) => ({ couple: row.couple_id, author: row.sender_id, client: row.client_id, kind: row.kind });
export function projectMessage<T extends ChatRow>(row: T): T {
  if (!row.enc || row.deleted_at || expired(row)) return row;
  try {
    const payload = decryptValue(row.enc, context(row)) as Payload;
    if (!payload || typeof payload !== 'object' || !(payload.body === null || typeof payload.body === 'string') || payload.reply !== row.reply_to || (row.media_path !== null && payload.path !== row.media_path)) throw new Error('Invalid encrypted message');
    if (row.kind === 'voice' && !isVoiceMeta(payload.meta)) throw new Error('Invalid encrypted voice metadata');
    if (payload.file && payload.file.path === row.media_path) rememberFile(payload.file);
    if (payload.preview) previews.set(payload.preview.url, payload.preview);
    return { ...row, body: payload.body, meta: payload.meta, decryptionError: undefined };
  } catch { return { ...row, body: '🔒 Unable to decrypt. Restore your recovery key in Privacy.', meta: null, decryptionError: true }; }
}
// Fetch from the sender's device only; never send private URLs to link-preview.
// Bound response size, disallow local addresses, and omit tracking images.
async function clientPreview(body: string | null): Promise<LinkPreview | null> {
  const link = firstLink(body); if (!link) return null;
  const url = new URL(link);
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[)/i.test(url.hostname)) return null;
  try {
    const response = await fetch(link, { signal: AbortSignal.timeout(4000), redirect: 'error' });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || Number(response.headers.get('content-length')) > 65536) return null;
    // Fetch implementations can buffer the body; URL owner still sees the sender IP.
    const html = (await response.text()).slice(0, 65536);
    const title = html.match(/<title[^>]*>([^<]{0,200})<\/title>/i)?.[1] ?? url.hostname;
    return { url: link, title, description: '', image: null };
  } catch { return { url: link, title: url.hostname, description: '', image: null }; }
}
export async function prepareMessage(row: ChatMessage) {
  if (!await encryptionRequired(row.couple_id)) return { body: row.body, meta: row.meta ?? null, enc: null, encryptedFile: undefined };
  if (row.enc) throw new Error('Retry from the decrypted local outbox');
  const attachment = row.localUri && row.media_path ? await encryptFile(row.localUri, row.media_path, row.kind === 'voice' ? 'audio/mp4' : 'image/jpeg') : undefined;
  const payload: Payload = { body: row.body, meta: row.meta ?? null, file: attachment?.file, preview: await clientPreview(row.body), reply: row.reply_to, path: row.media_path };
  return { body: null, meta: null, enc: encryptValue(payload, context(row)), encryptedFile: attachment?.ciphertext };
}
export async function editedBody(row: ChatRow, body: string | null): Promise<Partial<ChatRow>> {
  const required = await encryptionRequired(row.couple_id);
  if (!row.enc && !required) return { body };
  const previous = row.enc ? decryptValue(row.enc, context(row)) as Payload : { meta: row.meta, reply: row.reply_to, path: row.media_path };
  return { body: null, meta: null, enc: encryptValue({ ...previous, body, preview: await clientPreview(body) }, context(row)) };
}
export function projectReaction(row: Reaction): Reaction {
  if (!row.enc) return row;
  try { const emoji = decryptValue(row.enc, { couple: row.couple_id, author: row.user_id, client: row.message_id, kind: 'reaction' }); return { ...row, emoji: typeof emoji === 'string' ? emoji : '🔒' }; }
  catch { return { ...row, emoji: '🔒' }; }
}
export async function prepareReaction(couple: string, user: string, id: string, emoji: string) {
  return await encryptionRequired(couple) ? { emoji: '🔒', enc: encryptValue(emoji, { couple, author: user, client: id, kind: 'reaction' }) } : { emoji, enc: null };
}
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

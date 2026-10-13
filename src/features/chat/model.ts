import type { ChatRow } from './types';
import { isVoiceMeta } from '../voice/types';
import { projectMessage } from './body';

export type ChatMessage = ChatRow & {
  status: 'sending' | 'sent' | 'failed';
  localUri?: string;
};

export const asSent = (row: ChatRow): ChatMessage => ({ ...projectMessage(row), status: 'sent' });

// Server state wins over late HTTP failures and stale cache reads. A receipt
// cannot be rolled back by an INSERT echo which raced the read UPDATE.
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byClient = new Map(current.map((message) => [message.client_id, message]));
  for (const next of incoming) {
    const previous = byClient.get(next.client_id);
    if (previous?.status === 'sent' && next.status !== 'sent') continue;
    // A late INSERT echo must not resurrect deleted/edited content or un-open a photo.
    const stale = previous?.status === 'sent' && next.status === 'sent'
      && (!!previous.deleted_at && !next.deleted_at || !!previous.edited_at && (!next.edited_at || previous.edited_at > next.edited_at));
    const merged = { ...(stale ? previous : next), read_at: next.read_at ?? previous?.read_at ?? null,
      meta: next.meta && previous?.meta?.played_at ? { ...next.meta, played_at: next.meta.played_at ?? previous.meta.played_at } : next.meta,
      viewed_at: next.viewed_at ?? previous?.viewed_at ?? null };
    const keys = Object.keys(merged) as (keyof ChatMessage)[];
    byClient.set(next.client_id, previous && keys.every(key => merged[key] === previous[key])
      && (Object.keys(previous) as (keyof ChatMessage)[]).every(key => merged[key] === previous[key]) ? previous : merged);
  }
  return [...byClient.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}

export function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return ['id', 'client_id', 'couple_id', 'sender_id', 'created_at'].every((key) => typeof row[key] === 'string')
    && typeof row.created_at === 'string' && Number.isFinite(Date.parse(row.created_at))
    && ['text', 'image', 'system', 'voice'].includes(String(row.kind))
    && (row.kind !== 'voice' || !!row.enc || isVoiceMeta(row.meta))
    && ['body', 'media_path', 'reply_to', 'read_at'].every((key) => row[key] === null || typeof row[key] === 'string')
    && ['edited_at','deleted_at','pinned_at','expires_at','viewed_at'].every(key=>row[key]===undefined || row[key]===null || typeof row[key]==='string' && Number.isFinite(Date.parse(row[key])))
    && (row.view_once===undefined || typeof row.view_once==='boolean')
    && (row.pinned_by===undefined || row.pinned_by===null || typeof row.pinned_by==='string')
    && (row.localUri === undefined || typeof row.localUri === 'string');
}

export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export function grouped(a: ChatMessage, b: ChatMessage | undefined): boolean {
  return !!b && a.sender_id === b.sender_id
    && new Date(a.created_at).toDateString() === new Date(b.created_at).toDateString()
    && Math.abs(Date.parse(a.created_at) - Date.parse(b.created_at)) < 5 * 60_000;
}

// Persist failures as well as history, without making the offline outbox unbounded.
export function cacheWindow(messages: ChatMessage[]): ChatMessage[] {
  const pending = messages.filter((message) => message.status !== 'sent').slice(0, 200);
  const sent = messages.filter((message) => message.status === 'sent').slice(0, 200 - pending.length);
  return mergeMessages([], [...pending, ...sent]);
}

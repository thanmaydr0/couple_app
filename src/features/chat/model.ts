import type { MessageRow } from '@/types/db';

export type ChatMessage = MessageRow & {
  status: 'sending' | 'sent' | 'failed';
  localUri?: string;
};

export const asSent = (row: MessageRow): ChatMessage => ({ ...row, status: 'sent' });

// Server state wins over late HTTP failures and stale cache reads. A receipt
// cannot be rolled back by an INSERT echo which raced the read UPDATE.
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byClient = new Map(current.map((message) => [message.client_id, message]));
  for (const next of incoming) {
    const previous = byClient.get(next.client_id);
    if (previous?.status === 'sent' && next.status !== 'sent') continue;
    byClient.set(next.client_id, { ...next, read_at: next.read_at ?? previous?.read_at ?? null });
  }
  return [...byClient.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}

export function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return ['id', 'client_id', 'couple_id', 'sender_id', 'created_at'].every((key) => typeof row[key] === 'string')
    && typeof row.created_at === 'string' && Number.isFinite(Date.parse(row.created_at))
    && ['text', 'image', 'system'].includes(String(row.kind))
    && ['body', 'media_path', 'reply_to', 'read_at'].every((key) => row[key] === null || typeof row[key] === 'string')
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

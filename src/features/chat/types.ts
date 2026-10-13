import type { MessageRow } from '@/types/db';
import type { Envelope } from '@/features/e2ee/crypto';

import type { VoiceMeta } from '@/features/voice/types';
export type ChatRow = Omit<MessageRow, 'kind'> & {
  kind: MessageRow['kind'] | 'voice';
  enc?: Envelope | null;
  decryptionError?: boolean;
  meta?: VoiceMeta | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  pinned_at?: string | null;
  pinned_by?: string | null;
  expires_at?: string | null;
  view_once?: boolean;
  viewed_at?: string | null;
};
export type Reaction = { message_id: string; couple_id: string; user_id: string; emoji: string; created_at: string; enc?: Envelope | null };
export type ChatSettings = { couple_id: string; disappearing_seconds: number };
export type ScheduledMessage = {
  id: string; couple_id: string; created_by: string; run_at: string;
  status: 'pending' | 'done' | 'failed' | 'cancelled'; locked_until: string | null;
  sent_at?: string;
  payload: { body: string; client_id: string; enc?: Envelope; reply_to?: string | null; phrases?: string[]; recurrence?: { hour: number; minute: number; timezone: string } };
};
export type LinkPreview = { url: string; title: string; description: string; image: string | null };

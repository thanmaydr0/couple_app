import type { createClient } from '@supabase/supabase-js';
import type { Database, ProfileRow, WatchSessionRow, MessageRow, CoupleRow } from '../../src/types/db';
import type { Envelope, Sealed } from '../../src/features/e2ee/crypto';

type Table<R, I = Partial<R>> = { Row: R; Insert: I; Update: Partial<R>; Relationships: [] };
export type Message = Omit<MessageRow, 'kind'> & { kind: string; enc: Envelope | null; deleted_at: string | null; expires_at: string | null; view_once: boolean };
type WebDatabase = Omit<Database, 'public'> & { public: Omit<Database['public'], 'Tables'> & { Tables: Omit<Database['public']['Tables'], 'messages' | 'couples'> & {
  messages: Table<Message>;
  couples: Table<CoupleRow & { e2ee_enabled: boolean }>;
  user_keys: Table<{ user_id: string; couple_id: string; public_key: string }>;
  key_backups: Table<{ user_id: string; couple_id: string; blob: Sealed; salt: string; params: { N: number; r: number; p: number; dkLen: number } }>;
} } };
declare global { interface Window { US_CONFIG: { url: string; anonKey: string }; supabase: { createClient: typeof createClient } } }
const config = window.US_CONFIG;
export const configured = !!config?.url && !!config?.anonKey;
// Browser adapter: Android's src/lib/supabase.ts imports native AsyncStorage.
// Same project and RLS contract; storage is isolated from the Android session.
export const db = window.supabase.createClient<WebDatabase>(config?.url || 'https://unconfigured.supabase.co', config?.anonKey || 'unconfigured', {
  auth: { storageKey: 'us-web-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
export type { ProfileRow, WatchSessionRow };
export type Identity = { profile: ProfileRow & { couple_id: string }; partner: ProfileRow; anniversary: string | null };
export async function identity(uid: string): Promise<Identity> {
  const profile = await db.from('profiles').select('*').eq('id', uid).single();
  if (profile.error) throw profile.error;
  if (!profile.data.couple_id) throw new Error('Your account has not been paired yet. Ask the admin to link your couple, then retry.');
  const [partner, couple] = await Promise.all([
    db.from('profiles').select('*').eq('couple_id', profile.data.couple_id).neq('id', uid).single(),
    db.from('couples').select('anniversary').eq('id', profile.data.couple_id).single(),
  ]);
  if (partner.error) throw new Error('Your partner is not linked yet. Ask the admin to finish pairing your accounts.');
  if (couple.error) throw couple.error;
  return { profile: { ...profile.data, couple_id: profile.data.couple_id }, partner: partner.data, anniversary: couple.data.anniversary };
}
export function messageError(error: unknown) { return error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Something went wrong. Please retry.'; }

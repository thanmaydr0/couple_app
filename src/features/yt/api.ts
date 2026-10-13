import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Video, YtSession } from './types';
import { videoList } from './links';
// The feature owns its schema types; the shared generated database stays untouched.
const db = supabase as unknown as SupabaseClient;
export const sessionsTable = () => db.from('yt_sessions');
export function sessionRow(value: unknown): YtSession {
  const row = value as YtSession;
  if (!row || typeof row.id !== 'string' || typeof row.couple_id !== 'string' || typeof row.host_id !== 'string' || !['active', 'ended'].includes(row.status)) throw new Error('Invalid YouTube session.');
  return { ...row, queue: videoList(row.queue) };
}
export async function changeQueue(session: YtSession, queue: Video[], videoId = session.current_video_id) {
  const { data, error } = await sessionsTable().update({ queue, current_video_id: videoId }).eq('id', session.id).eq('couple_id', session.couple_id).eq('status', 'active').eq('queue', JSON.stringify(session.queue)).filter('current_video_id', session.current_video_id === null ? 'is' : 'eq', session.current_video_id).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Your partner changed Up next. Refresh and try again.');
  return sessionRow(data);
}

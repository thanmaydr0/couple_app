import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';
import { entrySchema, summarySchema, type Entry } from './types';

type StoryDatabase = { public: { Tables: Record<never, never>; Views: Record<never, never>; Functions: {
  story_summary: { Args: { p_year?: number; p_timezone: string }; Returns: unknown };
  story_feed: { Args: { p_before?: string; p_before_id?: string; p_limit: number; p_kind: string; p_day?: string; p_timezone: string }; Returns: unknown };
  story_memory_days: { Args: { p_timezone: string }; Returns: unknown };
} } };
const db = supabase as unknown as SupabaseClient<StoryDatabase>;
export async function summary(timezone: string, year?: number, signal?: AbortSignal) {
  let query = db.rpc('story_summary', { p_year:year, p_timezone:timezone });
  if (signal) query = query.abortSignal(signal);
  const { data,error } = await query; if (error) throw error; return summarySchema.parse(data);
}
export async function feed(timezone: string, kind = 'all', cursor?: Pick<Entry,'at'|'id'>, day?: string, signal?: AbortSignal) {
  let query = db.rpc('story_feed', { p_timezone:timezone, p_kind:kind, p_limit:40, p_before:cursor?.at, p_before_id:cursor?.id, p_day:day });
  if (signal) query = query.abortSignal(signal);
  const { data,error } = await query; if (error) throw error; return z.array(entrySchema).parse(data);
}
export async function memoryDays(timezone: string) {
  const { data,error } = await db.rpc('story_memory_days',{p_timezone:timezone});
  if (error) throw error;
  return z.array(z.object({day:z.string(),year:z.number(),count:z.number()})).parse(data);
}

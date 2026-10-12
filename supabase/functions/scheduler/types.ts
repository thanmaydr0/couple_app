import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
export type ScheduledJob = {
  id: string; couple_id: string; kind: string; run_at: string;
  payload: Record<string, unknown>; attempts: number; created_by: string;
};
export type JobContext = { admin: SupabaseClient; signal: AbortSignal };
/** At-least-once delivery. Each handler MUST deduplicate side effects by job.id,
 * scope every privileged query by job.couple_id and honor the deadline signal.
 * Never trust payload recipient IDs. Resolve membership server-side. */
export type JobHandler = (job: ScheduledJob, context: JobContext) => Promise<void>;

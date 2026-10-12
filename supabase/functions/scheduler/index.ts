import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { capsule_unlock } from './handlers/capsule_unlock.ts';
import { scheduled_message } from './handlers/scheduled_message.ts';
import { plan_reminder } from './handlers/plan_reminder.ts';
import { countdown } from './handlers/countdown.ts';
import { recurring_expense } from './handlers/recurring_expense.ts';
import { daily_digest } from './handlers/daily_digest.ts';
import { disappearing_purge } from './handlers/disappearing_purge.ts';
import type { JobHandler, ScheduledJob } from './types.ts';

const handlers: Record<string, JobHandler> = { capsule_unlock, scheduled_message, plan_reminder, countdown, recurring_expense, daily_digest, disappearing_purge };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function matchesSecret(provided: string, expected: string): Promise<boolean> {
  const encode = new TextEncoder();
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', encode.encode(value)));
  const [left, right] = await Promise.all([hash(provided), hash(expected)]);
  let difference = 0; for (let i = 0; i < left.length; i++) difference |= left[i]! ^ right[i]!;
  return difference === 0;
}
export async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return json({ error: 'Scheduler is not configured' }, 503);
  if (!await matchesSecret(req.headers.get('x-cron-secret') ?? '', expected)) return json({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Server configuration missing' }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) } });
  try {
    const { data, error } = await admin.rpc('claim_scheduled_jobs', { batch_size: 10 });
    if (error) return json({ error: 'Could not claim jobs' }, 503);
    const jobs = (data ?? []) as ScheduledJob[];
    const results = await Promise.all(jobs.map(async job => {
      let failure: string | null = null;
      try {
        const handler = handlers[job.kind]; if (!handler) throw new Error('Unsupported scheduler kind');
        // Race bounds work even if a future handler accidentally ignores signal.
        const signal = AbortSignal.timeout(30_000);
        await Promise.race([handler(job, { admin, signal }), new Promise<never>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Handler timed out')), { once: true }))]);
      } catch {
        // Avoid persisting/logging sensitive payloads or upstream service errors.
        failure = handlers[job.kind] ? 'Handler failed or is not implemented' : 'Unsupported scheduler kind';
      }
      const finish = await admin.rpc('finish_scheduled_job', { job_id: job.id, claim_attempt: job.attempts, failure });
      return { id: job.id, ok: !failure && !finish.error && finish.data === true, recorded: !finish.error && finish.data === true };
    }));
    return json({ claimed: jobs.length, completed: results.filter(result => result.ok).length, recorded: results.filter(result => result.recorded).length });
  } catch { return json({ error: 'Scheduler unavailable' }, 503); }
}
Deno.serve(handleRequest);

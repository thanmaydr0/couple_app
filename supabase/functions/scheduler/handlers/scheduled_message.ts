import type { JobHandler } from '../types.ts';
export const scheduled_message: JobHandler = async (job, { admin, signal }) => {
  signal.throwIfAborted();
  const sent = await admin.rpc('chat_dispatch_schedule', { job_id: job.id, claim_attempt: job.attempts }).abortSignal(signal);
  if (sent.error) throw new Error('Scheduled message dispatch failed');
  if (!sent.data) return;
  // Shared notify-partner currently authenticates user JWTs only. It must add
  // verified service scheduler_job_id authentication + push deduplication.
  // Keep failures retryable; dispatch itself and recurrence are transactional.
  const push = await admin.functions.invoke('notify-partner', { body: {
    channel: 'messages', title: 'A message for you', body: 'Your partner sent a message.',
    scheduler_job_id: job.id, data: { route: '/(tabs)/chat', message_id: sent.data, job_id: job.id },
  }, headers: { 'x-cron-secret': Deno.env.get('CRON_SECRET') ?? '' }, signal });
  if (push.error) throw new Error('notify-partner needs the service scheduler contract');
  const scrub = await admin.from('scheduled_jobs').update({ payload: {} }).eq('id', job.id).eq('couple_id', job.couple_id).abortSignal(signal);
  if (scrub.error) throw new Error('Scheduled payload cleanup failed');
};

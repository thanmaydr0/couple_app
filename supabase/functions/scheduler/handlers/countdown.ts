import type { JobHandler } from '../types.ts';
/** Shared notify-partner service authentication/deduplication is required. */
export const countdown: JobHandler = async (job, { admin, signal }) => {
  const id = job.payload.countdown_id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid countdown job');
  signal.throwIfAborted();
  const [source, stored, members] = await Promise.all([
    admin.from('countdowns').select('title,target_at').eq('id', id).eq('couple_id', job.couple_id).abortSignal(signal).maybeSingle(),
    admin.from('scheduled_jobs').select('status').eq('id', job.id).eq('couple_id', job.couple_id).abortSignal(signal).maybeSingle(),
    admin.from('profiles').select('id').eq('couple_id', job.couple_id).abortSignal(signal),
  ]);
  if (source.error || stored.error || members.error) throw new Error('Countdown lookup failed');
  if (!source.data || stored.data?.status !== 'pending' || Date.parse(source.data.target_at) !== Date.parse(job.run_at) || members.data?.length !== 2 || !members.data.some(p => p.id === job.created_by)) return;
  if (Date.parse(source.data.target_at) > Date.now()) throw new Error('Countdown not due');
  signal.throwIfAborted();
  const push = await admin.functions.invoke('notify-partner', { body: {
    channel: 'plans', title: source.data.title, body: 'The moment you have been waiting for is here ♡', scheduler_job_id: job.id,
    data: { route: '/us/plans', countdown_id: id, job_id: job.id },
  }, signal });
  if (push.error) throw new Error('notify-partner needs the service scheduler contract');
};

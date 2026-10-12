import type { JobHandler } from '../types.ts';
/** notify-partner shared integration required:
 * Accept a verified service caller + scheduler_job_id; resolve the author and
 * recipient from that job, recheck current capsule unlock_at/couple membership,
 * and deduplicate by scheduler_job_id. Never accept arbitrary recipient IDs.
 * The current user-JWT-only endpoint rejects this call; keep the job retryable
 * instead of claiming delivery or impersonating an author's session.
 */
export const capsule_unlock: JobHandler = async (job, { admin, signal }) => {
  const id = job.payload.capsule_id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid capsule job');
  signal.throwIfAborted();
  const result = await admin.from('capsules').select('id,author_id,unlock_at')
    .eq('id', id).eq('couple_id', job.couple_id).abortSignal(signal).maybeSingle();
  if (result.error) throw new Error('Capsule lookup failed');
  // Deleted/rescheduled jobs are harmless, including already claimed jobs.
  if (!result.data || result.data.author_id !== job.created_by || new Date(result.data.unlock_at).getTime() !== new Date(job.run_at).getTime()) return;
  if (new Date(result.data.unlock_at).getTime() > Date.now()) throw new Error('Capsule not yet due');
  const membership = await admin.from('profiles').select('id').eq('couple_id', job.couple_id).abortSignal(signal);
  if (membership.error) throw new Error('Membership lookup failed');
  const members = membership.data ?? [];
  if (members.length !== 2 || !members.some(member => member.id === result.data.author_id)) return;
  signal.throwIfAborted();
  const notification = await admin.functions.invoke('notify-partner', { body: {
    channel: 'capsule', title: 'A capsule is ready for you', body: 'A little love has finished waiting. Open your Time Capsule.',
    scheduler_job_id: job.id,
    data: { route: '/us/capsule', capsule_id: id, job_id: job.id },
  }, signal });
  if (notification.error) throw new Error('notify-partner requires its service scheduler contract');
};

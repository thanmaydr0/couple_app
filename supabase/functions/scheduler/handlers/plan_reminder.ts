import type { JobHandler } from '../types.ts';
/** notify-partner must support verified service callers and deduplicate by
 * scheduler_job_id. Its current user-JWT-only contract rejects scheduler calls;
 * preserve retry semantics until that shared integration is available. */
export const plan_reminder: JobHandler = async (job, { admin, signal }) => {
  const id = job.payload.event_id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid event job');
  signal.throwIfAborted();
  const valid = await admin.rpc('plans_reminder_valid', { job_id: job.id }).abortSignal(signal);
  if (valid.error) throw new Error('Reminder validation failed');
  if (!valid.data) return;
  const event = await admin.from('events').select('title,all_day,starts_at').eq('id', id).eq('couple_id', job.couple_id).abortSignal(signal).maybeSingle();
  if (event.error) throw new Error('Event lookup failed');
  if (!event.data) return;
  const members = await admin.from('profiles').select('id').eq('couple_id', job.couple_id).abortSignal(signal);
  if (members.error) throw new Error('Membership lookup failed');
  if (members.data?.length !== 2 || !members.data.some(p => p.id === job.created_by)) return;
  signal.throwIfAborted();
  const push = await admin.functions.invoke('notify-partner', { body: {
    channel: 'plans', title: event.data.title, body: event.data.all_day ? 'A special day is here.' : 'Your time together is coming up.',
    scheduler_job_id: job.id, data: { route: '/us/plans', event_id: id, job_id: job.id },
  }, signal });
  if (push.error) throw new Error('notify-partner needs the service scheduler contract');
  const next = await admin.rpc('plans_continue_reminder', { job_id: job.id }).abortSignal(signal);
  if (next.error) throw new Error('Recurring reminder continuation failed');
};

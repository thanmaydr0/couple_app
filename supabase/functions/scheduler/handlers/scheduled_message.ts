import type { JobHandler } from '../types.ts';
// Feature-owned stub. Implement scoped, idempotent work before enqueueing.
export const scheduled_message: JobHandler = async (_job, _context) => { throw new Error('Not implemented'); };

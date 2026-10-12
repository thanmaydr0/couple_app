import type { JobHandler } from '../types.ts';
// Feature-owned stub. Implement scoped, idempotent work before enqueueing.
export const daily_digest: JobHandler = async (_job, _context) => { throw new Error('Not implemented'); };

import type { JobHandler } from '../types.ts';
// Feature-owned stub. Implement scoped, idempotent work before enqueueing.
export const disappearing_purge: JobHandler = async (_job, _context) => { throw new Error('Not implemented'); };

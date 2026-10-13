import type { JobHandler } from '../types.ts';
/** Occurrence creation is transactional and deduplicated in wallet_run_recurring.
 * notify-partner must add a service-caller scheduler_job_id contract (shared owner).
 * Fail explicitly on that contract gap: never claim a push was delivered.
 */
export const recurring_expense: JobHandler = async (job,{admin,signal}) => {
 signal.throwIfAborted();
 const result=await admin.rpc('wallet_run_recurring',{p_job:job.id}).abortSignal(signal);
 if(result.error) throw new Error('Recurring expense transaction failed');
 const e=result.data as {id:string;couple_id:string;amount_minor:number;currency:string;note:string|null;category:string;deleted_at:string|null}|null;
 if(!e || e.deleted_at) return;
 if(e.couple_id!==job.couple_id || !Number.isSafeInteger(e.amount_minor)) throw new Error('Invalid recurring occurrence');
 const amount=new Intl.NumberFormat('en-IN',{style:'currency',currency:e.currency,maximumFractionDigits:2}).format(e.amount_minor/100);
 const notification=await admin.functions.invoke('notify-partner',{body:{channel:'plans',title:'A regular little expense',body:`${e.note || e.category} ${amount} added`,scheduler_job_id:job.id,data:{route:'/us/wallet',expense_id:e.id,job_id:job.id}},signal});
 if(notification.error) throw new Error('notify-partner requires service scheduler contract');
};

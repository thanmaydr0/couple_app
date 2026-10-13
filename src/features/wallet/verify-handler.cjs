const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../../supabase/functions/scheduler/handlers/recurring_expense.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020} }).outputText;
const sandbox = { exports:{}, Intl, Error, Number };
vm.runInNewContext(code, sandbox);
const handler = sandbox.exports.recurring_expense;
const job = {id:'job',couple_id:'couple',payload:{},created_by:'user'};
const expense = {id:'expense',couple_id:'couple',amount_minor:1500000,currency:'INR',note:'Rent',category:'rent',deleted_at:null};
function context(data, notificationError = null) {
 const calls = [];
 return { calls, signal:new AbortController().signal, admin:{
  rpc:(name,args)=>{ assert.equal(name,'wallet_run_recurring');assert.equal(args.p_job,job.id);return {abortSignal:async()=>({data,error:null})}; },
  functions:{invoke:async(name,args)=>{calls.push({name,args});return {error:notificationError};}}
 }};
}
(async()=>{
 const success=context(expense); await handler(job,success);
 assert.equal(success.calls.length,1);assert.equal(success.calls[0].name,'notify-partner');
 const body=success.calls[0].args.body;assert.equal(body.scheduler_job_id,'job');assert.equal(body.channel,'plans');assert.equal(body.data.route,'/us/wallet');assert(body.body.includes('15,000'));
 const cancelled=context(null);await handler(job,cancelled);assert.equal(cancelled.calls.length,0);
 const deleted=context({...expense,deleted_at:'now'});await handler(job,deleted);assert.equal(deleted.calls.length,0);
 const wrongCouple=context({...expense,couple_id:'outsider'});await assert.rejects(()=>handler(job,wrongCouple));assert.equal(wrongCouple.calls.length,0);
 await assert.rejects(()=>handler(job,context(expense,new Error('User JWT required'))),/service scheduler contract/);
 const aborted=context(expense);aborted.signal=AbortSignal.abort();await assert.rejects(()=>handler(job,aborted));assert.equal(aborted.calls.length,0);
 console.log('Wallet scheduler: 6 scenarios passed (success, cancelled, deleted, couple mismatch, rejected push, abort)');
})().catch(error=>{console.error(error);process.exitCode=1;});

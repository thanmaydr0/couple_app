const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const ts = require('typescript');
function load(path, imports = {}) {
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>{if(!(name in imports))throw new Error(`Unexpected import ${name}`);return imports[name];},Intl,Date,Set,Map,AbortSignal});
 return module.exports;
}
const time = load(join(__dirname,'time.ts'));
test('local reminder reconciliation is scoped, idempotent and cancels deleted events',async()=>{
 const scheduled = new Map([['chat',{identifier:'chat',content:{data:{feature:'chat'}}}]]);
 let scheduleCount=0; const canceled=[];
 const sdk={AndroidImportance:{HIGH:4},SchedulableTriggerInputTypes:{DATE:'date'},getAllScheduledNotificationsAsync:async()=>[...scheduled.values()],getPermissionsAsync:async()=>({granted:true}),setNotificationChannelAsync:async()=>{},cancelScheduledNotificationAsync:async id=>{canceled.push(id);scheduled.delete(id);},scheduleNotificationAsync:async request=>{scheduleCount++;scheduled.set(request.identifier,request);return request.identifier;}};
 const {syncNotifications}=load(join(__dirname,'notifications.ts'),{'expo-notifications':sdk,'./time':time});
 const start=new Date(Date.now()+3*time.DAY).toISOString();
 const event={id:'e',couple_id:'c',title:'Hello',starts_at:start,ends_at:new Date(Date.parse(start)+60*60_000).toISOString(),all_day:false,kind:'meet',repeat:'none',status:'confirmed',remind_minutes:[60],created_by:'a'};
 const people=[{id:'a',timezone:'Asia/Kolkata'},{id:'b',timezone:'America/New_York'}];
 await syncNotifications([event],people,true);assert.equal(scheduleCount,1);
 await syncNotifications([event],people,true);assert.equal(scheduleCount,1);
 await syncNotifications([{...event,title:'Updated'}],people,true);assert.equal(scheduleCount,2);
 await syncNotifications([],people,true);assert.equal(scheduled.size,1);assert.ok(scheduled.has('chat'));assert.ok(!canceled.includes('chat'));
 await syncNotifications([{...event,status:'proposed'}],people,true);assert.equal(scheduleCount,2);
 await syncNotifications([event],people,true);await syncNotifications([event],people,false);assert.equal(scheduled.size,1);
 const date=new Date(Date.now()+3*time.DAY).toISOString().slice(0,10);
 await syncNotifications([{...event,all_day:true,starts_at:`${date}T00:00:00Z`,ends_at:new Date(Date.parse(`${date}T00:00:00Z`)+time.DAY).toISOString()}],people,true,'Asia/Kolkata');
 const reminder=[...scheduled.values()].find(n=>n.content.data.feature==='plans');
 assert.equal(time.wall(reminder.trigger.date.getTime(),'Asia/Kolkata'),`${date}T08:00`);
 const allDay={...event,all_day:true,starts_at:`${date}T00:00:00Z`,ends_at:new Date(Date.parse(`${date}T00:00:00Z`)+time.DAY).toISOString()};
 await syncNotifications([allDay],people,true,'America/New_York');
 const moved=[...scheduled.values()].find(n=>n.content.data.feature==='plans');
 assert.equal(time.wall(moved.trigger.date.getTime(),'America/New_York'),`${date}T08:00`);
});
function adminFor({valid=true,event={title:'A date',all_day:false},source,stored='pending',pushError=null}={}) {
 const calls=[]; const admin={calls,rpc:name=>({abortSignal:async()=>{calls.push(name);return {data:valid,error:null};}}),from:table=>{
  const data=table==='events'?event:table==='countdowns'?source:table==='scheduled_jobs'?{status:stored}:[{id:'a'},{id:'b'}];
  const result={data,error:null};const chain={select:()=>chain,eq:()=>chain,abortSignal:()=>chain,maybeSingle:async()=>result,then:(resolve,reject)=>Promise.resolve(result).then(resolve,reject)};return chain;
 },functions:{invoke:async(name,options)=>{calls.push({name,options});return {error:pushError};}}};return admin;
}
const handlers=join(__dirname,'../../..','supabase/functions/scheduler/handlers');
const {plan_reminder}=load(join(handlers,'plan_reminder.ts'));
const {countdown}=load(join(handlers,'countdown.ts'));
const job={id:'00000000-0000-4000-8000-000000000001',couple_id:'c',created_by:'a',run_at:new Date(Date.now()-1000).toISOString(),payload:{event_id:'00000000-0000-4000-8000-000000000002',countdown_id:'00000000-0000-4000-8000-000000000003'}};
test('reminder worker ignores stale/deleted jobs and honors deadlines',async()=>{
 let admin=adminFor({valid:false});await plan_reminder(job,{admin,signal:new AbortController().signal});assert.equal(admin.calls.length,1);
 admin=adminFor();await assert.rejects(plan_reminder(job,{admin,signal:AbortSignal.abort()}));assert.equal(admin.calls.length,0);
});
test('worker failures remain retryable; successful reminders continue their series',async()=>{
 let admin=adminFor({pushError:new Error('Unauthorized')});await assert.rejects(plan_reminder(job,{admin,signal:new AbortController().signal}));assert.ok(!admin.calls.includes('plans_continue_reminder'));
 admin=adminFor();await plan_reminder(job,{admin,signal:new AbortController().signal});assert.ok(admin.calls.includes('plans_continue_reminder'));
 const push=admin.calls.find(call=>typeof call==='object');assert.equal(push.options.body.channel,'plans');assert.equal(push.options.body.scheduler_job_id,job.id);
});
test('countdown worker ignores deleted, cancelled or moved targets',async()=>{
 for(const options of [{source:null},{source:{title:'Hello',target_at:new Date(Date.now()+time.DAY).toISOString()}},{source:{title:'Hello',target_at:job.run_at},stored:'cancelled'}]) {
  const admin=adminFor(options);await countdown(job,{admin,signal:new AbortController().signal});assert.equal(admin.calls.length,0);
 }
 const admin=adminFor({source:{title:'Hello',target_at:job.run_at}});await countdown(job,{admin,signal:new AbortController().signal});assert.equal(admin.calls.length,1);
});

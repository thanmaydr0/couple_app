// Run with: node src/features/story/verify.cjs. Loads owned TypeScript directly;
// no installs, native runtime, or generated shared files are needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  const filename = path.resolve(__dirname, name + '.ts');
  if (cache.has(filename)) return cache.get(filename);
  const output = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module = {exports:{}};
  new Function('require','module','exports', output)((id)=>id.startsWith('.')?load(id):require(id),module,module.exports);
  cache.set(filename,module.exports);return module.exports;
}
const {longestStreak,milestones,cachedEmoji,recapCards} = load('model');
const {localDay,wallTime} = load('timezone');
const {summarySchema} = load('types');
const stats = (extra={})=>({total:0,photo_at:null,win_at:null,threshold_at:null,first_at:null,nth_at:null,seconds:0,longest:0,by_day:[],by_hour:[],by_person:[],by_kind:[],wins:[],...extra});
assert.deepEqual(longestStreak([{key:'2024-03-01',count:1},{key:'2024-02-28',count:1},{key:'2024-02-29',count:1},{key:'2024-03-03',count:1}]),{days:3,end:'2024-03-01'});
assert.equal(longestStreak([{key:'2025-12-31',count:4},{key:'2026-01-01',count:2}]).days,2);
assert.equal(wallTime('2026-10-13','Asia/Kolkata').toISOString(),'2026-10-13T03:30:00.000Z');
assert.equal(wallTime('2026-03-08','America/New_York').toISOString(),'2026-03-08T13:00:00.000Z');
assert.equal(wallTime('2026-11-01','America/New_York').toISOString(),'2026-11-01T14:00:00.000Z');
assert.equal(localDay(new Date('2026-01-01T00:30:00Z'),'America/Los_Angeles'),'2025-12-31');
const unlocked = milestones({media:stats({first_at:'2024-01-01T00:00:00Z',photo_at:'2024-02-01T00:00:00Z'}),messages:stats({total:1000,nth_at:'2024-03-01T00:00:00Z'}),calls:stats({threshold_at:'2024-04-01T00:00:00Z'})},'2024-02-29',new Date('2025-03-01T00:00:00Z'));
assert.equal(unlocked.find(m=>m.id==='milestone:photo').at,'2024-02-01T00:00:00Z');
assert.equal(unlocked.find(m=>m.id==='milestone:anniversary-2025').at,'2025-02-28T00:00:00.000Z');
assert(unlocked.some(m=>m.id==='milestone:message-1000'));
assert(unlocked.some(m=>m.id==='milestone:call-100'));
assert(!unlocked.some(m=>m.id==='milestone:day-500'));
const row=(id,body,extra={})=>({id,body,couple_id:'ours',created_at:'2026-01-01T10:00:00Z',...extra});
const rows=[row('a','👨‍👩‍👧‍👦 👨‍👩‍👧‍👦 ❤️'),row('b','❤️'),row('other','😂😂😂😂',{couple_id:'theirs'}),row('old','😂😂😂😂',{created_at:'2025-01-01T00:00:00Z'}),row('deleted','😂😂😂😂',{deleted_at:'2026-10-01'}),row('expired','😂😂😂😂',{expires_at:'2025-01-01'}),row('pending','😂😂😂😂',{status:'failed'})];
const client={getQueryCache:()=>({getAll:()=>[{queryKey:['messages'],state:{data:{pages:[rows,rows]}}}]})};
const emoji=cachedEmoji(client,'ours',2026,'UTC');
assert.equal(emoji.sampled,2);assert(['👨‍👩‍👧‍👦','❤️'].includes(emoji.emoji));
const cards=recapCards({messages:stats({total:10,by_person:[{key:'a',count:5},{key:'b',count:5}]}),calls:stats({seconds:120,longest:90}),game_rounds:stats({wins:[{key:'a',count:2}]})},{a:'You',b:'Partner'},emoji);
assert(cards.find(c=>c.id==='messages').detail.includes('same number'));
assert.equal(cards.find(c=>c.id==='calls').value,'2');
assert.equal(cards.find(c=>c.id==='game_rounds').value,'2');
assert(!cards.some(c=>/wallet|money/i.test(c.id)));
assert(!cards.some(c=>c.id==='movies'));
summarySchema.parse({messages:stats()});
assert.throws(()=>summarySchema.parse({messages:{total:'bad'}}));
console.log('Story verification passed: streaks, leap anniversaries, thresholds, DST, cache privacy/deduplication, recap counts, optional sources, payload validation.');

// Mock only native adapters to exercise the real scheduling queue and calendar.
async function checkReminders() {
  const OriginalDate=Date;const instant=OriginalDate.parse('2026-10-13T01:00:00Z');
  global.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[instant]));}static now(){return instant;}};
  let enabled=false;let online=true;let user='user';let memoryCalls=0;
  const planned=new Map([['other-feature',{identifier:'other-feature'}],['story-on-this-day:other:couple:2026-10-14',{identifier:'story-on-this-day:other:couple:2026-10-14'}]]);
  const mocks={
    'expo-notifications':{AndroidImportance:{DEFAULT:3},SchedulableTriggerInputTypes:{DATE:'date'},getAllScheduledNotificationsAsync:async()=>[...planned.values()],cancelScheduledNotificationAsync:async(id)=>planned.delete(id),getPermissionsAsync:async()=>({granted:true}),setNotificationChannelAsync:async()=>{},scheduleNotificationAsync:async(n)=>planned.set(n.identifier,n)},
    'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})}},
    react:{},'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async()=>String(enabled)}},
    '@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:user?{user:{id:user}}:null}})}}},
    './api':{memoryDays:async()=>{memoryCalls++;if(!online)throw new Error('offline');return [{day:'10-13',year:2024,count:1},{day:'10-14',year:2025,count:2},{day:'10-15',year:2026,count:1}];}},
    './timezone':load('timezone'),
  };
  const module={exports:{}};
  const output=ts.transpileModule(fs.readFileSync(path.join(__dirname,'notifications.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',output)(id=>mocks[id]??require(id),module,module.exports);
  const n=module.exports;
  try {
    await n.rescheduleReminders('user','couple','Asia/Kolkata');
    assert.equal(memoryCalls,0);assert.equal(planned.size,1);assert(planned.has('other-feature'));
    enabled=true;await n.rescheduleReminders('user','couple','Asia/Kolkata');
    assert.equal(planned.size,3);assert(planned.has('story-on-this-day:user:couple:2026-10-13'));assert(planned.has('story-on-this-day:user:couple:2026-10-14'));assert(!planned.has('story-on-this-day:user:couple:2026-10-15'));
    assert.equal(planned.get('story-on-this-day:user:couple:2026-10-13').trigger.date.toISOString(),'2026-10-13T03:30:00.000Z');
    await n.rescheduleReminders('user','couple','Asia/Kolkata');assert.equal(memoryCalls,1);
    enabled=false;await n.cancelStoryNotifications();assert.equal(planned.size,1);
    enabled=true;online=false;await assert.rejects(()=>n.rescheduleReminders('user','couple','Asia/Kolkata'),/offline/);assert(planned.has('other-feature'));
    online=true;await n.rescheduleReminders('user','couple','Asia/Kolkata');user=null;await n.cancelStoryNotifications();assert.equal(planned.size,1);
    console.log('Reminder checks passed: default off, nonempty historical dates only, 9AM timezone, deduplication, failure recovery, logout cancellation, unrelated reminders preserved.');
  } finally {global.Date=OriginalDate;}
}
checkReminders().catch(error=>{console.error(error);process.exitCode=1;});

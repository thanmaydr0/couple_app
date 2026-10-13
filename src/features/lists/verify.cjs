const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(name,mocks={}) {
 const code=ts.transpileModule(fs.readFileSync(`${__dirname}/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const result={exports:{}};vm.runInNewContext(code,{exports:result.exports,module:result,require:id=>id in mocks?mocks[id]:require(id),Date,Uint8Array,Math,Error});return result.exports;
}
const {candidates,decodeItem,claimPrefix}=load('types');
const row={id:'14000000-0000-4000-8000-000000000100',list_id:'14000000-0000-4000-8000-000000000200',couple_id:'14000000-0000-4000-8000-000000000010',title:'Picnic',notes:'#cheap #at-home',url:null,added_by:'14000000-0000-4000-8000-000000000001',position:1024,done_at:null,done_by:null,rating_a:null,rating_b:null,photo_path:null,media_id:null,hidden_from:null,revealed_at:null,created_at:new Date().toISOString()};
assert.equal(decodeItem(row).title,'Picnic');assert.throws(()=>decodeItem({...row,id:'invalid'}));
assert.equal(candidates([row,{...row,id:'done',done_at:'now'},{...row,id:'claim',url:claimPrefix+row.id}],'all').length,1);
assert.equal(candidates([row],'at home').length,1);assert.equal(candidates([row],'fancy').length,0);
let permission=true,cancel=false,existing=null,fail=false,picks=0;const uploads=[],inserts=[];
const client={
 rpc:async function(name){assert.equal(this,client);assert.equal(name,'lists_seed');return {error:null};},
 auth:{getSession:async()=>({data:{session:{user:{id:row.added_by}}}})},
 from:table=>{assert.equal(table,'media');return {select:()=>({eq:()=>({maybeSingle:async()=>({data:existing,error:null})})}),insert:async payload=>{inserts.push(payload);return {error:null};}};},
 storage:{from:bucket=>{assert.equal(bucket,'media');return {upload:async(path,bytes,options)=>{uploads.push({path,bytes,options});return {error:fail?new Error('Upload failed'):null};}};}}
};
const service=load('service',{
 '@/lib/supabase':{supabase:client},
 'expo-image-picker':{requestMediaLibraryPermissionsAsync:async()=>({granted:permission}),launchImageLibraryAsync:async()=>{picks++;return {canceled:cancel,assets:[{uri:'photo',width:4000,height:3000}]};}},
 'expo-image-manipulator':{SaveFormat:{JPEG:'jpeg'},manipulateAsync:async(uri)=>({uri,width:2560,height:1920})},
 'expo-file-system':{File:class {async arrayBuffer(){return new Uint8Array(20).buffer;}}}
});
(async()=>{
 await service.seedLists();
 await assert.rejects(()=>service.makeMemory(row,row.added_by),/Reveal and complete/);
 const completed={...row,done_at:new Date().toISOString(),done_by:row.added_by};
 await assert.rejects(()=>service.makeMemory({...completed,hidden_from:'partner'},row.added_by),/Reveal and complete/);
 await assert.rejects(()=>service.makeMemory(completed,'other'),/Account changed/);
 permission=false;await assert.rejects(()=>service.makeMemory(completed,row.added_by),/Allow photo/);permission=true;
 cancel=true;assert.equal(await service.makeMemory(completed,row.added_by),null);assert.equal(inserts.length,0);cancel=false;
 fail=true;await assert.rejects(()=>service.makeMemory(completed,row.added_by),/Upload failed/);assert.equal(inserts.length,0);fail=false;
 const now=Date.now();const result=await service.makeMemory(completed,row.added_by);assert.equal(result.id,row.id);assert.equal(inserts.length,1);
 assert.equal(inserts[0].caption,row.title);assert.ok(new Date(inserts[0].taken_at).getTime()>=now);
 assert.equal(inserts[0].storage_path,`${row.couple_id}/photos/${row.id}.jpg`);assert.equal(inserts[0].thumb_path,`${row.couple_id}/thumbs/${row.id}.jpg`);
 existing={id:row.id,storage_path:result.storage_path};const before=picks;await service.makeMemory(completed,row.added_by);assert.equal(picks,before);assert.equal(inserts.length,1);
 console.log('PASS: row validation, moods, completed/claim exclusion, bound seed RPC, private-memory guard, account check, permissions/cancel, upload failure, memory paths/caption/current date, retry deduplication.');
})().catch(error=>{console.error(error);process.exitCode=1;});

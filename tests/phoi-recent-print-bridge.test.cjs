const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function load(){
 const ctx={Date,Intl};ctx.globalThis=ctx;
 for(const file of ['phoi-recent-backup.js','phoi-recent-integration.js','phoi-recent-print-bridge.js']){
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),ctx);
 }
 return ctx.CuncunRecentPhoiPrintBridge;
}
test('real print history shape is backed up with original ID and creation timestamp',async()=>{
 const bridge=load(),store=new Map(),now=Date.now();
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const uploads=[];
 const supabase={from(table){
  if(table==='phoi_recent_backup_deletions')return {select:()=>({eq:()=>({eq:async()=>({data:[],error:null})})})};
  return {upsert:async row=>{uploads.push(row);return {error:null}}};
 }};
 const client=bridge.create({supabase,getUserId:async()=> 'owner-1',storage});
 const receipt={id:'p123',createdAt:now,text:'sample',printCount:1};
 const result=await client.saved(receipt);
 assert.equal(result.queued,true);
 await client.retry();
 assert.equal(uploads.length,1);
 assert.equal(uploads[0].receipt_id,'p123');
 assert.equal(uploads[0].receipt_snapshot.created_at,new Date(now).toISOString());
 assert.equal(uploads[0].receipt_snapshot.text,'sample');
});
test('restoring cloud history retains local records and avoids duplicates',async()=>{
 const bridge=load(),store=new Map(),now=Date.now();
 const local={id:'local',createdAt:now,text:'local text'};
 store.set('TSH_PRINT_HISTORY_V1',JSON.stringify([local]));
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const cloud={id:'remote',createdAt:now,created_at:new Date(now).toISOString(),text:'cloud text'};
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const supabase={from(table){
  if(table==='phoi_recent_backup_deletions')return {select:()=>({eq:()=>Promise.resolve({data:[],error:null})})};
  return {select:()=>({eq:()=>({in:async()=>({data:[{receipt_id:'remote',receipt_day:day,receipt_snapshot:cloud}],error:null})})})};
 }};
 const client=bridge.create({supabase,getUserId:async()=> 'owner-1',storage});
 const result=await client.recover();
 assert.equal(result.restored,1);
 const rows=JSON.parse(store.get('TSH_PRINT_HISTORY_V1'));
 assert.deepEqual(rows.map(x=>x.id),['local','remote']);
 assert.equal(rows[1].created_at,undefined);
 await client.recover();
 assert.equal(JSON.parse(store.get('TSH_PRINT_HISTORY_V1')).length,2);
});

test('corrupt or out-of-range local timestamp never throws or queues a backup',async()=>{
 const bridge=load(),store=new Map();
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const client=bridge.create({supabase:{},getUserId:async()=> 'owner-1',storage});
 for(const createdAt of [Number.MAX_VALUE,-1,0,NaN,'bad']){
  const result=await client.saved({id:'bad',createdAt});
  assert.equal(result.queued,false);
 }
 assert.equal(client.pending(),0);
});

test('corrupt existing history JSON does not crash restore adapter',async()=>{
 const bridge=load(),store=new Map([['TSH_PRINT_HISTORY_V1','{broken json']]);
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const client=bridge.create({supabase:{},getUserId:async()=> 'owner-1',storage});
 // No network call: the adapter must remain constructible even with corrupt data.
 assert.equal(typeof client.recover,'function');
 assert.equal(client.pending(),0);
});

test('cloud restore never resurrects a receipt marked deleted locally',async()=>{
 const bridge=load(),store=new Map(),now=Date.now();
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const cloud={id:'deleted-on-phone',createdAt:now,created_at:new Date(now).toISOString(),text:'old receipt'};
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const supabase={from(table){
  if(table==='phoi_recent_backup_deletions')return {
   select:()=>({eq:()=>Promise.resolve({data:[],error:null})}),
   upsert:async()=>({error:null})
  };
  return {select:()=>({eq:()=>({in:async()=>({data:[{receipt_id:cloud.id,receipt_day:day,receipt_snapshot:cloud}],error:null})})})};
 }};
 const client=bridge.create({supabase,getUserId:async()=> 'owner-1',storage});
 const deleted=await client.deleted(cloud.id);
 assert.equal(deleted.synced,true);
 const result=await client.recover();
 assert.equal(result.restored,0);
 assert.equal(JSON.parse(store.get('TSH_PRINT_HISTORY_V1')||'[]').length,0);
});

test('restore refuses to write another account cloud receipts after auth switches',async()=>{
 const bridge=load(),store=new Map(),now=Date.now();
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 let userId='owner-1',writes=0;
 const cloud={id:'owner-1-receipt',createdAt:now,created_at:new Date(now).toISOString()};
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const supabase={from(table){
  if(table==='phoi_recent_backup_deletions')return {select:()=>({eq:()=>Promise.resolve({data:[],error:null})})};
  return {select:()=>({eq:()=>({in:async()=>{userId='owner-2';return {data:[{receipt_id:cloud.id,receipt_day:day,receipt_snapshot:cloud}],error:null};}})})};
 }};
 const client=bridge.create({supabase,getUserId:async()=>userId,storage:{
  getItem:storage.getItem,
  setItem:(k,v)=>{if(k==='TSH_PRINT_HISTORY_V1')writes++;storage.setItem(k,v)}
 }});
 await assert.rejects(()=>client.recover(),/Account changed during restore/);
 assert.equal(writes,0);
});

test('restore aborts if account switches during deletion ledger lookup',async()=>{
 const bridge=load(),store=new Map(),now=Date.now();
 const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 let userId='owner-1',writes=0;
 const cloud={id:'remote',createdAt:now,created_at:new Date(now).toISOString()};
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 let authChecks=0;
 const getUserId=async()=>{authChecks++;if(authChecks===7)userId='owner-2';return userId;};
 const supabase={from(table){
  if(table==='phoi_recent_backup_deletions')return {select:()=>({eq:()=>Promise.resolve({data:[],error:null})})};
  return {select:()=>({eq:()=>({in:async()=>({data:[{receipt_id:cloud.id,receipt_day:day,receipt_snapshot:cloud}],error:null})})})};
 }};
 const client=bridge.create({supabase,getUserId,storage:{
  getItem:storage.getItem,
  setItem:(k,v)=>{if(k==='TSH_PRINT_HISTORY_V1')writes++;storage.setItem(k,v)}
 }});
 await assert.rejects(()=>client.recover(),/Account changed/);
 assert.equal(writes,0);
});

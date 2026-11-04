const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function load(){
 const ctx={Date,Intl};ctx.globalThis=ctx;
 for(const name of ['phoi-recent-backup.js','phoi-recent-integration.js']){
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),ctx);
 }
 const integration=ctx.CuncunRecentPhoiIntegration;
 const original=integration.create;
 integration.create=args=>original({...args,supabase:{
  from(table){
   if(table==='phoi_recent_backup_deletions')return {
    select:()=>({eq:()=>({eq:async()=>({data:[],error:null}),then:fn=>Promise.resolve({data:[],error:null}).then(fn)})}),
    upsert:async(row,opts)=>args.supabase.deletionUpsert?args.supabase.deletionUpsert(row,opts):{error:null}
   };
   return args.supabase.from(table);
  }
 }});
 return integration;
}
test('saved receipt is queued without waiting for a stalled cloud upload',async()=>{
 const integration=load();
 const store=new Map();let resolveUpload,uploadStarted=false;
 const storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>{store.set(key,value)}};
 const supabase={from:()=>({upsert:()=>{uploadStarted=true;return new Promise(resolve=>{resolveUpload=resolve;});}})};
 const client=integration.create({supabase,getUserId:async()=> 'owner-1',storage,readLocal:async()=>[],writeLocal:async()=>{}});
 const result=await client.onReceiptSaved({id:'p1',created_at:new Date().toISOString()});
 assert.equal(result.queued,true);
 assert.equal(client.pending(),1);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(uploadStarted,true);
 resolveUpload({error:null});
 await client.retry();
 assert.equal(client.pending(),0);
});
test('recovery merges cloud receipts without replacing local copies',async()=>{
 const integration=load();
 let raw='[]',written=null;
 const storage={getItem:()=>raw,setItem:(_,value)=>{raw=value}};
 const now=new Date();
 const receipt={id:'p1',created_at:now.toISOString(),total:99};
 const local=[{...receipt,total:5}];
 const supabase={from:()=>({select:()=>({eq:()=>({in:async()=>({data:[{receipt_id:'p1',receipt_day:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),receipt_snapshot:receipt}],error:null})})})})};
 const client=integration.create({supabase,getUserId:async()=> 'owner-1',storage,readLocal:async()=>local,writeLocal:async rows=>{written=rows;}});
 const result=await client.recover();
 assert.equal(result.restored,0);
 assert.equal(written,null);
});

test('recovery refuses to write when account changes during cloud fetch',async()=>{
 const integration=load();
 let raw='[]',userId='owner-1',writes=0;
 const storage={getItem:()=>raw,setItem:(_,value)=>{raw=value}};
 const now=new Date();
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const receipt={id:'remote',created_at:now.toISOString()};
 const supabase={from:()=>({select:()=>({eq:()=>({in:async()=>{userId='owner-2';return {data:[{receipt_id:'remote',receipt_day:day,receipt_snapshot:receipt}],error:null};}})})})};
 const client=integration.create({supabase,getUserId:async()=>userId,storage,readLocal:async()=>[],writeLocal:async()=>{writes++;}});
 await assert.rejects(()=>client.recover(),/Account changed during restore/);
 assert.equal(writes,0);
});

test('local storage failure never throws into the print flow',async()=>{
 const integration=load();
 const storage={getItem:()=> '[]',setItem:()=>{throw new Error('QuotaExceededError');}};
 const client=integration.create({supabase:{},getUserId:async()=> 'owner-1',storage,readLocal:async()=>[],writeLocal:async()=>{}});
 const result=await client.onReceiptSaved({id:'p1',created_at:new Date().toISOString()});
 assert.equal(result.queued,false);
 assert.equal(result.error,'backup_unavailable');
});

test('authentication lookup failure never throws into the print flow',async()=>{
 const integration=load();
 const storage={getItem:()=> '[]',setItem:()=>{}};
 const client=integration.create({supabase:{},getUserId:async()=>{throw new Error('offline auth');},storage,readLocal:async()=>[],writeLocal:async()=>{}});
 const result=await client.onReceiptSaved({id:'p1',created_at:new Date().toISOString()});
 assert.equal(result.queued,false);
 assert.equal(result.error,'backup_unavailable');
});

test('recovery preserves a new local receipt added during cloud restoration',async()=>{
 const integration=load();
 const now=new Date();
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const remote={id:'remote-1',created_at:now.toISOString()};
 const newLocal={id:'local-new',created_at:now.toISOString()};
 let reads=0,written=null;
 const supabase={from:()=>({select:()=>({eq:()=>({in:async()=>({data:[{receipt_id:remote.id,receipt_day:day,receipt_snapshot:remote}],error:null})})})})};
 const client=integration.create({
  supabase,getUserId:async()=> 'owner-1',
  storage:{getItem:()=> '[]',setItem:()=>{}},
  readLocal:async()=>{reads++;return reads===1?[]:[newLocal];},
  writeLocal:async rows=>{written=rows;}
 });
 const result=await client.recover();
 assert.equal(reads,2);
 assert.equal(result.restored,1);
 assert.equal(written.length,2);
 assert.ok(written.some(x=>x.id==='local-new'));
 assert.ok(written.some(x=>x.id==='remote-1'));
});

// The receipt-save hook is intentionally not enabled in production until the
// actual index.html persistence point and its receipt shape are verified.

test('deleted receipt writes local marker before cloud tombstone',async()=>{
 const integration=load();
 const calls=[];
 const supabase={deletionUpsert:async row=>{calls.push('cloud:'+row.owner_user_id+':'+row.receipt_id);return {error:null}}};
 const client=integration.create({
  supabase,getUserId:async()=> 'owner-1',
  storage:(()=>{const store=new Map();return {getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)}})(),
  readLocal:async()=>[],writeLocal:async()=>{},
  onReceiptDeletedLocal:async id=>{calls.push('local:'+id);}
 });
 const result=await client.onReceiptDeleted('receipt-1');
 assert.equal(result.synced,true);
 assert.deepEqual(calls,['local:receipt-1','cloud:owner-1:receipt-1']);
});
test('deleted receipt is retained locally when cloud is unavailable',async()=>{
 const integration=load();
 let local=false;
 const supabase={deletionUpsert:async()=>({error:new Error('offline')})};
 const client=integration.create({
  supabase,getUserId:async()=> 'owner-1',
  storage:(()=>{const store=new Map();return {getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)}})(),
  readLocal:async()=>[],writeLocal:async()=>{},
  onReceiptDeletedLocal:async()=>{local=true;}
 });
 const result=await client.onReceiptDeleted('receipt-1');
 assert.equal(result.synced,false);
 assert.equal(local,true);
});
test('offline deletion persists for retry and clears after connection returns',async()=>{
 const integration=load();
 const store=new Map();
 let offline=true;
 const supabase={deletionUpsert:async()=>({error:offline?new Error('offline'):null})};
 const client=integration.create({
  supabase,getUserId:async()=> 'owner-1',
  storage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  readLocal:async()=>[],writeLocal:async()=>{},
  onReceiptDeletedLocal:async()=>{}
 });
 const first=await client.onReceiptDeleted('receipt-1');
 assert.equal(first.synced,false);
 assert.equal(client.pending(),1);
 offline=false;
 const retried=await client.retry();
 assert.equal(retried.deletions.synced,1);
 assert.equal(client.pending(),0);
});

test('restore excludes receipts pending offline deletion for current account',async()=>{
 const integration=load();
 const now=new Date();
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const remote={id:'deleted-receipt',created_at:now.toISOString()};
 const store=new Map([['cuncun_pending_phoi_deletions_v1',JSON.stringify([{userId:'owner-1',receiptId:remote.id}])]]);
 const supabase={from:()=>({select:()=>({eq:()=>({in:async()=>({data:[{receipt_id:remote.id,receipt_day:day,receipt_snapshot:remote}],error:null})})})})};
 let written=false;
 const client=integration.create({
  supabase,getUserId:async()=> 'owner-1',
  storage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  readLocal:async()=>[],writeLocal:async()=>{written=true;}
 });
 const result=await client.recover();
 assert.equal(result.restored,0);
 assert.equal(written,false);
});

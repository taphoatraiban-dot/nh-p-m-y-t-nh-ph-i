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

test('invalid deletion IDs cannot create local or remote tombstones',async()=>{
 const integration=load();
 let localCalls=0,cloudCalls=0;
 const client=integration.create({
  supabase:{deletionUpsert:async()=>{cloudCalls++;return {error:null}}},
  getUserId:async()=> 'owner-1',
  storage:{getItem:()=>null,setItem:()=>{}},
  readLocal:async()=>[],writeLocal:async()=>{},
  onReceiptDeletedLocal:async()=>{localCalls++}
 });
 for(const id of [null,undefined,'','   ',42]){
  const result=await client.onReceiptDeleted(id);
  assert.equal(result.synced,false);
  assert.equal(result.error,'invalid_receipt_id');
 }
 assert.equal(localCalls,0);
 assert.equal(cloudCalls,0);
});

test('failed local deletion marker must not send a cloud tombstone',async()=>{
 const integration=load();
 let cloudCalls=0;
 const client=integration.create({
  supabase:{deletionUpsert:async()=>{cloudCalls++;return {error:null}}},
  getUserId:async()=> 'owner-1',
  storage:{getItem:()=>null,setItem:()=>{}},
  readLocal:async()=>[],writeLocal:async()=>{},
  onReceiptDeletedLocal:async()=>{throw new Error('local storage full')}
 });
 const result=await client.onReceiptDeleted('receipt-1');
 assert.equal(result.synced,false);
 assert.equal(cloudCalls,0);
 assert.equal(client.pending(),0);
});

test('retry blocks old backup uploads until offline deletion markers sync',async()=>{
 const integration=load();
 const store=new Map();
 const receipt={id:'receipt-deleted',created_at:new Date().toISOString()};
 store.set('cuncun_pending_phoi_backups',JSON.stringify([{userId:'owner-1',receipt}]));
 store.set('cuncun_pending_phoi_deletions_v1',JSON.stringify([{userId:'owner-1',receiptId:receipt.id}]));
 let uploads=0,offline=true;
 const supabase={
  deletionUpsert:async()=>({error:offline?new Error('offline'):null}),
  from:()=>({upsert:async()=>{uploads++;return {error:null}}})
 };
 const client=integration.create({
  supabase,getUserId:async()=> 'owner-1',
  storage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  readLocal:async()=>[],writeLocal:async()=>{}
 });
 const first=await client.retry();
 assert.equal(first.backups.error,'pending_deletions');
 assert.equal(uploads,0);
 assert.equal(client.pending(),2);
 offline=false;
 const second=await client.retry();
 assert.equal(second.deletions.synced,1);
 // Once the tombstone is durable, a stale upload may be attempted safely:
 // the server trigger must reject it, or the backup helper must skip it.
 assert.equal(second.backups.error,null);
 assert.equal(client.pending(),0);
});

test('automatic receipt save respects pending offline deletions',async()=>{
 const integration=load();
 const store=new Map([['cuncun_pending_phoi_deletions_v1',JSON.stringify([{userId:'owner-1',receiptId:'old-deleted'}])]]);
 let uploads=0;
 const client=integration.create({
  supabase:{deletionUpsert:async()=>({error:new Error('offline')}),from:()=>({upsert:async()=>{uploads++;return {error:null}}})},
  getUserId:async()=> 'owner-1',
  storage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  readLocal:async()=>[],writeLocal:async()=>{}
 });
 const result=await client.onReceiptSaved({id:'new-receipt',created_at:new Date().toISOString()});
 assert.equal(result.queued,true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(uploads,0);
 assert.equal(client.pending(),2);
});

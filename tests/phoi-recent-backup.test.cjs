const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={Date,Intl};ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/phoi-recent-backup.js'),'utf8'),ctx);
const api=ctx.CuncunRecentPhoiBackup;
const realBackup=api.backup,realRestore=api.restore;
function testClient(db){
 return {from(table){
  if(table==='phoi_recent_backup_deletions')return {select:()=>({eq:()=>({eq:async()=>({data:[],error:null}),then:fn=>Promise.resolve({data:[],error:null}).then(fn)})})};
  return db.from(table);
 }};
}
for(const method of ['backup','restore','createBackupQueue']){
 const original=api[method];
 api[method]=args=>original({...args,supabase:testClient(args.supabase)});
}

test('Vietnamese day boundary and yesterday at midnight',()=>{
 assert.equal(api.dayKey('2026-11-03T17:30:00Z'),'2026-11-04');
 assert.deepEqual(Array.from(api.allowedDays(new Date('2026-11-04T18:00:00Z'))),['2026-11-05','2026-11-04']);
});
test('upsert is idempotent by owner and receipt id',async()=>{
 let calls=[];
 const supabase={from:()=>({upsert:async(row,opts)=>{calls.push({row,opts});return {error:null}}})};
 const receipt={id:'p-1',created_at:'2026-11-04T03:00:00Z',amount:100};
 await api.backup({supabase,userId:'owner-1',receipt,now:new Date('2026-11-04T05:00:00Z')});
 await api.backup({supabase,userId:'owner-1',receipt,now:new Date('2026-11-04T05:00:00Z')});
 assert.equal(calls.length,2);
 assert.equal(calls[0].opts.onConflict,'owner_user_id,receipt_id');
 assert.equal(calls[0].row.receipt_snapshot.amount,100);
});
test('old receipt is skipped without database writes',async()=>{
 const supabase={from:()=>{throw new Error('unexpected write')}};
 const result=await api.backup({supabase,userId:'owner-1',receipt:{id:'old',created_at:'2026-11-01T03:00:00Z'},now:new Date('2026-11-04T05:00:00Z')});
 assert.equal(result.skipped,true);
});

test('restore only current and previous Vietnam dates',async()=>{
 const now=new Date('2026-11-04T18:00:00Z');
 const rows=[
  {receipt_id:'old',receipt_day:'2026-11-03',receipt_snapshot:{id:'old',created_at:'2026-11-03T03:00:00Z'}},
  {receipt_id:'yesterday',receipt_day:'2026-11-04',receipt_snapshot:{id:'yesterday',created_at:'2026-11-04T03:00:00Z'}},
  {receipt_id:'today',receipt_day:'2026-11-05',receipt_snapshot:{id:'today',created_at:'2026-11-04T18:00:00Z'}}
 ];
 const supabase={from:()=>({select:()=>({eq:()=>({in:()=>Promise.resolve({data:rows,error:null})})})})};
 const restored=await api.restore({supabase,userId:'owner-1',now});
 assert.deepEqual(Array.from(restored,x=>x.id),['yesterday','today']);
});
test('missing user cannot access backups',async()=>{
 await assert.rejects(()=>api.restore({supabase:{},userId:''}),/Authenticated user required/);
});

test('offline queue retries and does not discard failed receipts',async()=>{
 let raw='[]',fail=true;
 const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v}};
 const supabase={from:()=>({upsert:async()=>({error:fail?new Error('offline'):null})})};
 const queue=api.createBackupQueue({supabase,getUserId:async()=> 'owner-1',storage});
 queue.enqueue({id:'receipt-1',created_at:'2026-11-04T03:00:00Z',total:50},'owner-1');
 assert.equal(queue.pending(),1);
 const now=new Date('2026-11-04T05:00:00Z');
 const first=await queue.flush(now);
 assert.equal(first.pending,1);
 fail=false;
 const second=await queue.flush(now);
 assert.equal(second.saved,1);
 assert.equal(queue.pending(),0);
});
test('invalid receipt date is rejected before queueing',()=>{
 let raw='[]';
 const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v}};
 const queue=api.createBackupQueue({supabase:{},getUserId:async()=>null,storage});
 assert.throws(()=>queue.enqueue({id:'x',created_at:'bad'},'owner-1'),/Invalid receipt creation time/);
});

test('queued receipts from another account are never uploaded under current user',async()=>{
 let raw='[]',uploaded=[];
 const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v}};
 const supabase={from:()=>({upsert:async row=>{uploaded.push(row);return {error:null}}})};
 const queue=api.createBackupQueue({supabase,getUserId:async()=> 'owner-2',storage});
 queue.enqueue({id:'a',created_at:'2026-11-04T03:00:00Z'},'owner-1');
 queue.enqueue({id:'b',created_at:'2026-11-04T03:00:00Z'},'owner-2');
 const result=await queue.flush(new Date('2026-11-04T05:00:00Z'));
 assert.equal(result.saved,1);
 assert.equal(result.pending,1);
 assert.equal(uploaded[0].receipt_id,'b');
 assert.equal(uploaded[0].owner_user_id,'owner-2');
});

test('receipt enqueued during in-flight upload survives flush',async()=>{
 let raw='[]',release;
 const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v}};
 const supabase={from:()=>({upsert:()=>new Promise(resolve=>{release=()=>resolve({error:null})})})};
 const queue=api.createBackupQueue({supabase,getUserId:async()=> 'owner-1',storage});
 queue.enqueue({id:'first',created_at:'2026-11-04T03:00:00Z'},'owner-1');
 const running=queue.flush(new Date('2026-11-04T05:00:00Z'));
 await new Promise(resolve=>setImmediate(resolve));
 queue.enqueue({id:'second',created_at:'2026-11-04T03:00:00Z'},'owner-1');
 release();
 await running;
 assert.equal(queue.pending(),1);
 assert.equal(JSON.parse(raw)[0].receipt.id,'second');
});
test('simultaneous flush calls share one upload',async()=>{
 let raw='[]',uploads=0;
 const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v}};
 const supabase={from:()=>({upsert:async()=>{uploads++;return {error:null}}})};
 const queue=api.createBackupQueue({supabase,getUserId:async()=> 'owner-1',storage});
 queue.enqueue({id:'once',created_at:'2026-11-04T03:00:00Z'},'owner-1');
 await Promise.all([queue.flush(new Date('2026-11-04T05:00:00Z')),queue.flush(new Date('2026-11-04T05:00:00Z'))]);
 assert.equal(uploads,1);
});

test('restore merge preserves local records and adds only missing recent records',()=>{
 const now=new Date('2026-11-04T05:00:00Z');
 const local=[{id:'existing',created_at:'2026-11-01T03:00:00Z',total:111},{id:'same',created_at:'2026-11-04T03:00:00Z',total:200}];
 const remote=[{id:'same',created_at:'2026-11-04T03:00:00Z',total:999},{id:'new',created_at:'2026-11-04T03:00:00Z',total:300},{id:'old',created_at:'2026-11-01T03:00:00Z',total:400}];
 const merged=api.mergeRestored(local,remote,now);
 assert.deepEqual(Array.from(merged,x=>x.id),['existing','same','new']);
 assert.equal(merged[1].total,200);
 assert.equal(local.length,2);
});

test('restore rejects rows whose receipt id or Vietnam date differs from metadata',async()=>{
 const now=new Date('2026-11-04T05:00:00Z');
 const rows=[
  {receipt_id:'valid',receipt_day:'2026-11-04',receipt_snapshot:{id:'valid',created_at:'2026-11-04T03:00:00Z'}},
  {receipt_id:'other',receipt_day:'2026-11-04',receipt_snapshot:{id:'mismatch',created_at:'2026-11-04T03:00:00Z'}},
  {receipt_id:'wrong-day',receipt_day:'2026-11-04',receipt_snapshot:{id:'wrong-day',created_at:'2026-11-03T03:00:00Z'}},
  {receipt_id:'broken',receipt_day:'2026-11-04',receipt_snapshot:{id:'broken',created_at:'not-a-date'}}
 ];
 const supabase={from:()=>({select:()=>({eq:()=>({in:async()=>({data:rows,error:null})})})})};
 const restored=await api.restore({supabase,userId:'owner-1',now});
 assert.deepEqual(Array.from(restored,x=>x.id),['valid']);
});
test('invalid queued entry cannot stop a valid receipt from uploading',async()=>{
 let raw=JSON.stringify([
  {userId:'owner-1',receipt:{id:'broken',created_at:'invalid'}},
  {userId:'owner-1',receipt:{id:'valid',created_at:'2026-11-04T03:00:00Z'}}
 ]);
 const storage={getItem:()=>raw,setItem:(_,value)=>{raw=value}};
 const uploaded=[];
 const supabase={from:()=>({upsert:async row=>{uploaded.push(row.receipt_id);return {error:null}}})};
 const queue=api.createBackupQueue({supabase,getUserId:async()=> 'owner-1',storage});
 const result=await queue.flush(new Date('2026-11-04T05:00:00Z'));
 assert.deepEqual(uploaded,['valid']);
 assert.equal(result.pending,1);
 assert.equal(result.error,'retry_required');
});

test('merge excludes cloud receipts explicitly deleted by the owner',()=>{
 const now=new Date('2026-11-04T05:00:00Z');
 const cloud=[{id:'deleted-1',created_at:'2026-11-04T03:00:00Z'},{id:'kept-1',created_at:'2026-11-04T03:00:00Z'}];
 const merged=api.mergeRestored([],cloud,now,['deleted-1']);
 assert.deepEqual(Array.from(merged,x=>x.id),['kept-1']);
});

test('deletion markers are account-scoped and prevent restore resurrection',async()=>{
 const store=new Map();
 let userId='account-a';
 const ledger=api.createDeletionLedger({
  storage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  getUserId:async()=>userId
 });
 const now=new Date('2026-11-04T05:00:00Z');
 await ledger.markDeleted('receipt-1',now);
 assert.deepEqual(Array.from(await ledger.deletedIds(now)),['receipt-1']);
 userId='account-b';
 assert.deepEqual(Array.from(await ledger.deletedIds(now)),[]);
 userId='account-a';
 const merged=api.mergeRestored([],[{id:'receipt-1',created_at:'2026-11-04T03:00:00Z'}],now,await ledger.deletedIds(now));
 assert.equal(merged.length,0);
});

test('cloud tombstone works before the first receipt backup',async()=>{
 const calls=[];
 const supabase={from(table){
  assert.equal(table,'phoi_recent_backup_deletions');
  return {upsert:async(row,options)=>{calls.push({row,options});return {error:null}}};
 }};
 await api.markCloudDeleted({supabase,userId:'owner-a',receiptId:'receipt-1',now:new Date('2026-11-04T05:00:00Z')});
 assert.equal(calls[0].row.owner_user_id,'owner-a');
 assert.equal(calls[0].row.receipt_id,'receipt-1');
 assert.equal(calls[0].options.ignoreDuplicates,true);
});

test('deleted receipt is not uploaded even when a stale queue retries',async()=>{
 const now=new Date('2026-11-04T05:00:00Z');
 let uploaded=false;
 const supabase={from(table){
  if(table==='phoi_recent_backup_deletions')return {select:()=>({eq:()=>({eq:async()=>({data:[{receipt_id:'gone'}],error:null})})})};
  return {upsert:async()=>{uploaded=true;return {error:null}}};
 }};
 const result=await realBackup({supabase,userId:'owner-1',receipt:{id:'gone',created_at:'2026-11-04T03:00:00Z'},now});
 assert.equal(result.reason,'deleted_receipt');
 assert.equal(uploaded,false);
});
test('restore excludes independently deleted cloud receipts',async()=>{
 const now=new Date('2026-11-04T05:00:00Z');
 const receipt={id:'gone',created_at:'2026-11-04T03:00:00Z'};
 const supabase={from(table){
  if(table==='phoi_recent_backup_deletions')return {select:()=>({eq:()=>Promise.resolve({data:[{receipt_id:'gone'}],error:null})})};
  return {select:()=>({eq:()=>({in:async()=>({data:[{receipt_id:'gone',receipt_day:'2026-11-04',receipt_snapshot:receipt}],error:null})})})};
 }};
 const restored=await realRestore({supabase,userId:'owner-1',now});
 assert.equal(restored.length,0);
});

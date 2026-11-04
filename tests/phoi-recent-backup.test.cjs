const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={Date,Intl};ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/phoi-recent-backup.js'),'utf8'),ctx);
const api=ctx.CuncunRecentPhoiBackup;
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

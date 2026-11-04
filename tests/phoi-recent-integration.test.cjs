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
 return ctx.CuncunRecentPhoiIntegration;
}
test('saved receipt is queued without waiting for a stalled cloud upload',async()=>{
 const integration=load();
 let raw='[]',resolveUpload,uploadStarted=false;
 const storage={getItem:()=>raw,setItem:(_,value)=>{raw=value}};
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

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

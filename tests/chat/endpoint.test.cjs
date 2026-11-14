const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../../supabase/functions/telegram-chat/index.ts'),'utf8').replace(/^import[^\n]+\n/,''));
const uid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',ticket='x'.repeat(72);
async function setup(){
 let handler,authenticated=true,enabled=true,visible=true,stale=false,expired=false;const jobs=[],queries=[];
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ticket));const ticketHash=Buffer.from(digest).toString('hex');
 const db={auth:{getUser:async()=>({data:{user:authenticated?{id:uid}:null}})},rpc:async(name)=>({data:name==='telegram_account_entitled'?true:[],error:null}),from(table){const filters={};let write=null;const q={select(){return q},eq(k,v){filters[k]=v;return q},neq(){return q},order(){return q},limit(){return q},gte(){return q},maybeSingle(){return q},update(v){write=v;return q},upsert(v){if(table==='telegram_chat_outbox'&&!jobs.some(j=>j.id===v.id))jobs.push({...v,state:'queued'});return q},then(resolve){queries.push({table,filters,write});let data=[];
 if(table==='telegram_chat_access')data={enabled:true,worker_seen_at:new Date().toISOString()};
 if(table==='telegram_chat_pins')data={ticket_hash:ticketHash,expires_at:new Date(Date.now()+(expired?-1:600000)).toISOString()};
 if(table==='telegram_member_groups')data=visible?{chat_id:-123,enabled:true,last_seen_at:new Date(Date.now()-(stale?600000:0)).toISOString()}:null;
 if(table==='telegram_chat_outbox')data=jobs.find(j=>j.user_id===filters.user_id&&j.id===filters.id)||null;
 return Promise.resolve(resolve({data,error:null}));}};return q;}};
 vm.runInNewContext(source,{createClient:()=>db,Deno:{env:{get:k=>k==='TELEGRAM_CHAT_ENABLED'?(enabled?'true':'false'):'test'},serve:cb=>handler=cb},crypto,TextEncoder,Response,URL,console});
 return{jobs,queries,auth:v=>authenticated=v,enabled:v=>enabled=v,visible:v=>visible=v,stale:v=>stale=v,expired:v=>expired=v,call:async(action,body={},proof=ticket)=>{const r=await handler(new Request('https://example.test/?action='+action,{method:'POST',headers:{authorization:'Bearer jwt','x-chat-ticket':proof},body:JSON.stringify(body)}));return{status:r.status,data:await r.json()};}};
}
test('endpoint rejects missing login, missing or expired PIN ticket, and disabled deployment',async()=>{
 const s=await setup();s.auth(false);assert.equal((await s.call('send')).status,401);s.auth(true);assert.equal((await s.call('send',{},'')).status,423);s.expired(true);assert.equal((await s.call('send')).status,423);s.enabled(false);assert.equal((await s.call('status')).status,503);
});
test('sending is scoped to logged-in user and rejects unauthorized chats and stale worker',async()=>{
 const s=await setup();const b={id,chat_id:-123,text:'hello',user_id:'attacker'};s.visible(false);assert.equal((await s.call('send',b)).status,403);s.visible(true);s.stale(true);assert.equal((await s.call('send',b)).status,409);s.stale(false);assert.equal((await s.call('send',b)).status,200);assert.equal(s.jobs[0].user_id,uid);assert(s.queries.filter(q=>q.table==='telegram_member_groups').every(q=>q.filters.user_id===uid));
});
test('same UUID is idempotent; a conflicting payload cannot overwrite an existing send',async()=>{
 const s=await setup(),b={id,chat_id:-123,text:'hello'};assert.equal((await s.call('send',b)).status,200);assert.equal((await s.call('send',b)).status,200);assert.equal(s.jobs.length,1);assert.equal((await s.call('send',{...b,text:'different'})).status,409);assert.equal(s.jobs[0].message_text,'hello');assert.equal((await s.call('send',{...b,text:'x'.repeat(4097)})).status,400);
});

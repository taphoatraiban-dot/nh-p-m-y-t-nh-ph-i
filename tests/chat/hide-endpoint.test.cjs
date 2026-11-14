const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/telegram-chat/index.ts','utf8').replace(/^import[^\n]+\n/,''));
const uid='11111111-1111-4111-8111-111111111111',proof='x'.repeat(72);
async function setup(){
 const hidden=[],writes=[],queries=[],messages=[1,2].map(message_id=>({user_id:uid,chat_id:-123,message_id,message_text:'Test',message_date:new Date().toISOString()}));
 const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(proof))).toString('hex');
 let handler,login=true,expired=false,allowed=true;
 const db={rpc:async()=>({data:true,error:null}),auth:{getUser:async()=>({data:{user:login?{id:uid}:null}})},from(table){let single=false,rows,filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},neq(k,v){filters.push(r=>r[k]!==v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(){return q},limit(){return q},gte(){return q},maybeSingle(){single=true;return q},upsert(v){writes.push({table,rows:v});if(table==='telegram_member_hidden')for(const x of v)if(!hidden.some(h=>h.user_id===x.user_id&&h.chat_id===x.chat_id&&h.message_id===x.message_id))hidden.push(x);return q},then(resolve){queries.push(table);rows=table==='telegram_chat_access'?[{user_id:uid,enabled:true}]:table==='telegram_chat_pins'?[{user_id:uid,ticket_hash:hash,expires_at:new Date(Date.now()+(expired?-1:600000)).toISOString()}]:table==='telegram_member_groups'?(allowed?[{user_id:uid,chat_id:-123,group_name:'Test',enabled:true}]:[]):table==='telegram_member_messages'?messages:table==='telegram_member_hidden'?hidden:table==='telegram_chat_outbox'?[{user_id:uid,chat_id:-123,message_id:1,state:'sent',message_text:'Test'}]:[];rows=rows.filter(r=>filters.every(f=>f(r)));return Promise.resolve(resolve({data:single?rows[0]||null:rows,error:null}));}};return q;}};
 vm.runInNewContext(source,{createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handler=fn},crypto,TextEncoder,Response,URL});
 return{hidden,writes,messages,auth:v=>login=v,expire:v=>expired=v,allow:v=>allowed=v,call:async(action,body={},ticket=proof)=>{const r=await handler(new Request('https://test/?action='+action,{method:'POST',headers:{authorization:'Bearer jwt','x-chat-ticket':ticket},body:JSON.stringify(body)}));return{status:r.status,body:await r.json()};}};
}
test('hide rejects login/PIN/expiry failures and unauthorized conversation without writing',async()=>{
 const s=await setup(),b={chat_id:-123,message_ids:[1]};s.auth(false);assert.equal((await s.call('hide',b)).status,401);s.auth(true);assert.equal((await s.call('hide',b,'')).status,423);s.expire(true);assert.equal((await s.call('hide',b)).status,423);s.expire(false);s.allow(false);assert.equal((await s.call('hide',b)).status,403);assert.equal(s.writes.length,0);
});
test('hide validates all messages and account scope, deduplicates and never deletes source data',async()=>{
 const s=await setup();assert.equal((await s.call('hide',{chat_id:-123,message_ids:[1,999]})).status,404);for(const ids of [[],[0],['1'],Array(201).fill(1)])assert.equal((await s.call('hide',{chat_id:-123,message_ids:ids})).status,400);
 assert.equal((await s.call('hide',{user_id:'other',chat_id:-123,message_ids:[1,1,2]})).status,200);assert.equal(s.hidden.length,2);assert(s.hidden.every(h=>h.user_id===uid));assert.equal(s.messages.length,2);assert(s.writes.every(w=>w.table==='telegram_member_hidden'));
});
test('read after hide suppresses received messages and sent outbox copies, including repeated reads',async()=>{
 const s=await setup();assert.equal((await s.call('read',{chat_id:-123})).body.messages.length,2);await s.call('hide',{chat_id:-123,message_ids:[1]});for(let i=0;i<2;i++){const r=await s.call('read',{chat_id:-123});assert.equal(r.status,200);assert.deepEqual(r.body.messages.map(m=>m.message_id),[2]);assert.equal(r.body.jobs.length,0);assert(!r.body.notices.some(m=>m.message_id===1));}
 await s.call('hide',{chat_id:-123,message_ids:[1]});assert.equal(s.hidden.length,1);assert.equal((await s.call('read',{})).body.jobs.length,0);
});

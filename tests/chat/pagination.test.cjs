'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/telegram-chat/index.ts','utf8').replace(/^import[^\n]+\n/,''));
const uid='11111111-1111-4111-8111-111111111111',ticket='x'.repeat(72);
async function setup(){
 let handler,authorized=true;const rows=[],hidden=[],cleared=[],queries=[];
 const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ticket))).toString('hex');
 const tables={telegram_member_messages:rows,telegram_member_hidden:hidden,telegram_chat_cleared:cleared,telegram_member_groups:[{user_id:uid,chat_id:-123,enabled:true,group_name:'Test'}],telegram_chat_access:[{user_id:uid,enabled:true}],telegram_chat_pins:[{user_id:uid,ticket_hash:hash,expires_at:new Date(Date.now()+600000).toISOString()}],telegram_chat_outbox:[]};
 const db={rpc:async()=>({data:true,error:null}),auth:{getUser:async()=>({data:{user:authorized?{id:uid}:null}})},from(table){
  const filters=[],orders=[];let size=Infinity,single=false,or='';
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},neq(k,v){filters.push(r=>r[k]!==v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},gt(k,v){filters.push(r=>Date.parse(r[k])>Date.parse(v));return q},gte(k,v){filters.push(r=>Date.parse(r[k])>=Date.parse(v));return q},or(value){or=value;const m=value.match(/^message_date.lt.(.*),and\(message_date.eq.(.*),message_id.lt.(\d+)\)$/);if(!m||m[1]!==m[2])throw Error('Invalid cursor filter');filters.push(r=>r.message_date<m[1]||(r.message_date===m[1]&&r.message_id<Number(m[3])));return q},order(k,o={}){orders.push([k,o.ascending!==false]);return q},limit(n){size=n;return q},maybeSingle(){single=true;return q},then(resolve){
   queries.push({table,or});let data=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));
   for(const [key,asc] of orders.toReversed())data.sort((a,b)=>(a[key]<b[key]?-1:a[key]>b[key]?1:0)*(asc?1:-1));
   data=data.slice(0,size);return Promise.resolve(resolve({data:single?data[0]||null:data,error:null}));
  }};return q;
 }};
 vm.runInNewContext(source,{createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handler=fn},crypto,TextEncoder,Response,URL});
 return{rows,hidden,cleared,queries,auth:v=>authorized=v,async read(body={},proof=ticket){const r=await handler(new Request('https://example.test/?action=read',{method:'POST',headers:{authorization:'Bearer jwt','x-chat-ticket':proof},body:JSON.stringify(body)}));return{status:r.status,body:await r.json()};}};
}
const message=(id,extra={})=>({user_id:uid,chat_id:-123,message_id:id,message_date:'2026-11-15T01:00:00.123456+00:00',message_text:'Test',...extra});
test('keyset pagination traverses 450 equal-timestamp messages exactly once, despite new arrivals',async()=>{
 const s=await setup();s.rows.push(...Array.from({length:450},(_,i)=>message(i+1)),message(999,{user_id:'other'}),message(1000,{chat_id:999}));
 const first=await s.read({chat_id:-123});assert.equal(first.status,200);assert.equal(first.body.messages.length,200);assert.equal(first.body.next_before.id,251);assert.equal(first.body.next_before.date,'2026-11-15T01:00:00.123456+00:00');
 s.rows.push(message(451));
 const second=await s.read({chat_id:-123,before:first.body.next_before});const third=await s.read({chat_id:-123,before:second.body.next_before});
 assert.equal(third.body.next_before,null);
 const ids=[...first.body.messages,...second.body.messages,...third.body.messages].map(m=>m.message_id).sort((a,b)=>a-b);
 assert.deepEqual(ids,Array.from({length:450},(_,i)=>i+1));
});
test('hidden-only pages still advance and cleared messages cannot reappear in history',async()=>{
 const s=await setup();s.rows.push(...Array.from({length:401},(_,i)=>message(i+1)));
 s.hidden.push(...s.rows.filter(m=>m.message_id>=202).map(({user_id,chat_id,message_id})=>({user_id,chat_id,message_id})));
 const first=await s.read({chat_id:-123});assert.equal(first.body.messages.length,0);assert.equal(first.body.next_before.id,202);
 const second=await s.read({chat_id:-123,before:first.body.next_before});assert.equal(second.body.messages.length,200);
 s.cleared.push({user_id:uid,chat_id:-123,cleared_at:'2026-11-15T02:00:00Z'});
 const cleared=await s.read({chat_id:-123});assert.deepEqual(cleared.body.messages,[]);assert.equal(cleared.body.next_before,null);
});
test('pagination rejects malformed or injectable cursors and preserves login/PIN/conversation authorization',async()=>{
 const s=await setup();
 for(const before of [null,{}, {date:'x),user_id.neq.x',id:1},{date:'2026-11-15T01:00:00Z',id:0},{date:'2026-11-15T01:00:00Z',id:'1'}])assert.equal((await s.read({chat_id:-123,before})).status,400);
 assert.equal((await s.read({chat_id:999,before:{date:'2026-11-15T01:00:00Z',id:10}})).status,403);
 assert.equal((await s.read({chat_id:-123},'')).status,423);s.auth(false);assert.equal((await s.read({chat_id:-123})).status,401);
});

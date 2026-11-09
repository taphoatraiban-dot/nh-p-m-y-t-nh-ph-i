const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/telegram-chat/index.ts','utf8').replace(/^import[^\n]+\n/,''));
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',key='test-sync-key-'.repeat(5);
async function setup(){let handler,enabled=true;const claims=[];const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))).toString('hex');
 const db={auth:{getUser:async()=>({data:{user:null}})},rpc:async(name,args)=>{claims.push({name,args});return{data:[],error:null}},from(table){let user;const q={select(){return q},eq(k,v){if(k==='user_id')user=v;return q},maybeSingle(){return q},then(resolve){return Promise.resolve(resolve({data:user===uid?(table==='telegram_member_sync_keys'?{secret_hash:hash}:{enabled}):null,error:null}));}};return q;}};
 vm.runInNewContext(source,{createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handler=fn},crypto,TextEncoder,Response,URL});
 return{claims,enabled:v=>enabled=v,call:async(action='claim',user=uid,secret=key,body={})=>{const r=await handler(new Request('https://test/?action='+action,{method:'POST',headers:{'Content-Type':'application/json','x-sync-user':user,'x-sync-key':secret},body:JSON.stringify(body)}));return{status:r.status,body:await r.json()};}};
}
test('valid worker sync key claims its own queue without a JWT',async()=>{const s=await setup();assert.equal((await s.call()).status,200);assert.equal(s.claims.length,1);assert.equal(s.claims[0].args.p_user,uid);});
test('wrong key or different account cannot claim a queue',async()=>{const s=await setup();assert.equal((await s.call('claim',uid,'wrong'.repeat(20))).status,401);assert.equal((await s.call('claim',other,key)).status,401);assert.equal(s.claims.length,0);});
test('disabled account cannot claim even with the right key',async()=>{const s=await setup();s.enabled(false);assert.equal((await s.call()).status,403);assert.equal(s.claims.length,0);});
test('ack rejects missing receipt fields after sync-key validation',async()=>{const s=await setup();assert.equal((await s.call('ack')).status,400);assert.equal(s.claims.length,0);});

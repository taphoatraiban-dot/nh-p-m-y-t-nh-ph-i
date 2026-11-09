const {test}=require('node:test'),assert=require('node:assert/strict');
const {checkGateway}=require('../../scripts/check-telegram-chat-gateway.cjs');
test('gateway probe uses invalid worker credentials and cannot claim or send a message',async()=>{
 let called=false;await checkGateway(undefined,async(url,options)=>{called=true;assert.equal(url.searchParams.get('action'),'ack');assert(!options.headers.Authorization);assert.deepEqual(JSON.parse(options.body),{});return{status:401,json:async()=>({error:'Unauthorized'})};});assert(called);
});
test('gateway guard rejects JWT-gateway interception, accidental public access and server errors',async()=>{
 for(const [status,body] of [[401,{code:'UNAUTHORIZED_NO_AUTH_HEADER',message:'Missing authorization header'}],[200,{success:true}],[500,{error:'Unavailable'}]])await assert.rejects(checkGateway(undefined,async()=>({status,json:async()=>body})));
});
test('gateway guard rejects network errors',async()=>{await assert.rejects(checkGateway(undefined,async()=>{throw Error('offline')}));});

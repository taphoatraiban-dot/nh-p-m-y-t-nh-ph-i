import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseAdminServerAdapter} from './supabase-admin-server-adapter.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
const req={headers:{authorization:'Bearer '+ 'a'.repeat(32)}};
test('rejects missing trusted server clients',()=>assert.throws(()=>createSupabaseAdminServerAdapter(),/SUPABASE_SERVER_CLIENTS_REQUIRED/));
test('valid admin token plus admin_users membership',async()=>{
 let checked='';
 const authClient={auth:{getUser:async token=>{checked=token;return {data:{user:{id}},error:null}}}};
 const adminDb={from:table=>{assert.equal(table,'admin_users');return {select:()=>({eq:(field,value)=>{assert.equal(field,'user_id');assert.equal(value,id);return {limit:async()=>({data:[{user_id:id}],error:null})}}})}}};
 const verify=createSupabaseAdminServerAdapter({authClient,adminDb});
 assert.equal((await verify(req)).id,id);assert.equal(checked,'a'.repeat(32));
});
test('denies missing admin membership',async()=>{
 const verify=createSupabaseAdminServerAdapter({authClient:{auth:{getUser:async()=>({data:{user:{id}},error:null})}},adminDb:{from:()=>({select:()=>({eq:()=>({limit:async()=>({data:[],error:null})})})})}});
 assert.equal(await verify(req),null);
});
test('denies auth errors before admin query',async()=>{
 let queried=false;
 const verify=createSupabaseAdminServerAdapter({authClient:{auth:{getUser:async()=>({data:{user:null},error:{message:'bad token'}})}},adminDb:{from:()=>{queried=true;throw Error('unexpected')}}});
 assert.equal(await verify(req),null);assert.equal(queried,false);
});
test('denies database errors',async()=>{
 const verify=createSupabaseAdminServerAdapter({authClient:{auth:{getUser:async()=>({data:{user:{id}},error:null})}},adminDb:{from:()=>({select:()=>({eq:()=>({limit:async()=>({data:null,error:{message:'db error'}})})})})}});
 assert.equal(await verify(req),null);
});

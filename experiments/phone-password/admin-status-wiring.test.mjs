import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminStatusWiring} from './admin-status-wiring.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
const token='test-token-12345678901234567890';
test('server-side auth and admin membership both required',async()=>{
 let member=false;
 const authClient={auth:{getUser:async()=>({data:{user:{id}},error:null})}};
 const adminDb={from:()=>({select:()=>({eq:()=>({limit:async()=>({data:member?[{user_id:id}]:[],error:null})})})})};
 const status=createAdminStatusWiring({authClient,adminDb});
 const request={headers:{authorization:'Bearer '+token}};
 assert.equal((await status(request)).body.admin,false);
 member=true;
 assert.deepEqual((await status(request)).body,{authenticated:true,admin:true});
});
test('missing clients and missing token fail closed',async()=>{
 assert.throws(()=>createAdminStatusWiring(),/SUPABASE_SERVER_CLIENTS_REQUIRED/);
 const status=createAdminStatusWiring({authClient:{auth:{getUser:async()=>({data:{user:null}})}},adminDb:{from:()=>({})}});
 assert.equal((await status({headers:{}})).status,401);
});
